# WP-317 — Composable `gain-resource` Grant Observability Logging (Empowered / Berserk)

**User-Visible Surface:** play.legendary-arena.com (the in-match game log panel,
`G.messages` → `UIState.log`). After this packet, whenever a composition-marker
mechanic (Empowered, Berserk, and future cousins) grants Attack or Recruit, the
player sees a line naming the card and the amount — e.g. `Player 0's
antm/black-knight/amulet-of-avalon#2 gained +3 attack.`. Today that grant is
**silent**, so an Empowered-heavy turn looks like the ability "did nothing."

## Goal

The composable-primitive interpreter's `gain-resource` executor
(`interpretGainResourceNode` in
`packages/game-engine/src/hero/effectPrimitive.interpret.ts`) adds Attack/Recruit
to the turn economy but appends **no** `G.messages` line on success. Every
mechanic built on the D-24029/D-24044 composable substrate (Empowered — all four
forms — and Berserk) therefore grants **invisibly**. This packet appends a
grant line to `G.messages` each time a `gain-resource` node runs, naming the
source card and the amount, so those grants become observable in the play log
(and in diagnostics). This is the **per-effect amount logging** that WP-295
explicitly deferred (`WP-295 §Out of Scope` → "drew N, +N attack, +N recruit
inside the handlers"), scoped to the composable substrate. Because `G.messages`
is excluded from the `finalStateHash` oracle (D-24081 / WP-294), the addition
touches only the dedicated `messages` oracle, never the hash.

## User-Visible Impact

A player reading the in-match log, after playing an Empowered card, now sees a
line like `Player 0's antm/wonder-man/8th-wonder-of-the-world#0 gained +2
attack.` (and a `+0` line when a composition ran but had no matching cards to
count — e.g. Empowered by a class with zero cards in the HQ). Previously the
grant left no trace, so the diagnostic from match `f2Yzlzb9yLh` (2026-07-06)
showed only condition-skip failures and silence for an Empowered-heavy deck —
Empowered looked broken when it was actually granting Attack the whole time.

## Assumes

- **WP-294 complete (D-24081):** `hashGameState`
  (`packages/game-engine/src/test/fixtures/hashGameState.ts`) excludes the
  top-level `messages` field, so new log lines do NOT change `finalStateHash`.
- **WP-295 complete (D-24082):** `applyCardPlay` already appends `Player <id>
  played <ext-id>.` and the `executeHeroEffects` condition-failed branch appends
  a `… did not activate …` line. This packet is the sibling grant-logging pass
  WP-295 §Out of Scope deferred; the card-naming form here mirrors WP-295's
  `… ability did not activate …` line.
- **D-24029 / D-24044 substrate:** `interpretHeroPrimitiveEffect`
  (`effectPrimitive.interpret.ts:550`) is the entry point that walks a
  composition AST; `EFFECT_NODE_HANDLERS['gain-resource']` =
  `interpretGainResourceNode` adds to `G.turnEconomy` via `addResources` and
  currently pushes nothing on success (only `pushPrimitiveWarning` on a missing
  economy). `gain-resource` nodes originate **only** from
  `HERO_COMPOSITION_MARKERS` (Berserk) and the parameterized Empowered builders
  (`buildEmpowered*Composition` in `rules/heroCompositions.ts`), so the log fires
  only for composition-marker cards — not for every hero.
- **Call sites of `interpretHeroPrimitiveEffect`:** `heroEffects.execute.ts:329`
  (inside the hook loop — `hook.cardId` is the source card in scope) and
  `moves/drawOrEmpowered.resolve.ts:112` (the draw-or-empowered resolve path).
- `G.messages: string[]` is the deterministic event log projected to
  `UIState.log` (WP-200 / quiet panel).
- `EffectExecutionContext = Map<string, CardExtId>` is the transient bind/ref map
  created fresh per top-level effect and never persisted (D-24029 §9).
- The sentinel trajectory oracle is
  `test/fixtures/games/sentinel-core-doom-2p.replay.json`; its recorded
  trajectory contains **no** composition-marker card, so its `messages` /
  `snapshotPerTurn[].messages` are expected to be **unchanged** by this packet.
- `pnpm --filter @legendary-arena/game-engine build` / `test` exit 0 on baseline
  (`origin/main` @ `6c64d920`).

If any of the above is false, this packet is **BLOCKED**.

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Debuggability & Diagnostics` — non-obvious behavior
  SHOULD append a human-readable `G.messages` entry for replay inspection. This
  packet applies that posture to the composable substrate.
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — read
  `interpretGainResourceNode` (the silent grant), the `EffectNodeHandler` type,
  `interpretSequenceNode` (recurses into child nodes — must forward the new
  source-card param), `interpretMoveCardNode` (ignores it), and
  `interpretHeroPrimitiveEffect` (the entry point that receives the new param and
  seeds it into dispatch). Note the "mechanic-agnostic" invariant: the log line
  must NOT name the mechanic (the interpreter does not know Empowered vs Berserk)
  — only the source card, amount, and resource.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the `hook.cardId`
  source at the `interpretHeroPrimitiveEffect(G, ctx, playerID, primitiveEffect)`
  call (~:329).
- `packages/game-engine/src/moves/drawOrEmpowered.resolve.ts` — the resolve-path
  call (~:112); pass the source cardId if the pending choice carries it, else
  `undefined` (the line degrades to the no-card form for that path).
- `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` — the existing
  interpreter tests; add grant-log assertions here.
- `packages/game-engine/src/rules/heroCompositions.ts` — the `buildEmpowered*` /
  Berserk compositions whose `gain-resource` nodes this packet makes observable.
- `docs/ai/DECISIONS.md` — D-24029/D-24030/D-24031/D-24044 (the composable
  substrate), D-24081 (messages excluded from the hash), D-24082 (WP-295's
  play/skip-logging decision this extends), D-24016 (the legacy `Count-scaled
  attack: +N` precedent).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:`), Rule 4 (no
  abbreviations), full-sentence messages.

## Scope (In)

### §A — Thread the source card into the interpreter

In `effectPrimitive.interpret.ts`, add a `sourceCardId: CardExtId | undefined`
parameter to `interpretHeroPrimitiveEffect` and to the `EffectNodeHandler`
signature, forwarding it through `interpretSequenceNode`'s recursion so a nested
`gain-resource` inside a `sequence` (Berserk) sees it. `interpretMoveCardNode`
accepts and ignores it (`_sourceCardId`). A `// why:` comment states that the
source card is execution provenance for the grant log only — it never enters `G`
or a binding, preserving the D-24029 §9 replay invariant.

### §B — Grant log in `interpretGainResourceNode`

After the successful `addResources` grant (for BOTH the `attack` and `recruit`
branches), append one `G.messages` line via `pushPrimitiveWarning`'s array-guard
pattern (reuse the guard; do NOT throw on a missing `messages`):

- When `sourceCardId` is defined: `` `Player ${playerID}'s ${sourceCardId} gained +${amount} ${resource}.` ``
- When `sourceCardId` is undefined: `` `Player ${playerID} gained +${amount} ${resource}.` ``

`${resource}` is the literal `attack` or `recruit`. The line is emitted for
**every** `gain-resource` run **including `amount === 0`** — a `+0` line
distinguishes "the composition ran but counted zero matching cards" (a correct
no-op, e.g. Empowered by a class absent from the HQ) from "the ability did not
activate" (WP-295's condition-skip line, a different cause). A `// why:` comment
cites WP-317 / D-24103, notes the interpreter is mechanic-agnostic (no mechanic
name in the copy), and notes the `+0` rationale.

### §C — Tests

- `effectPrimitive.interpret.test.ts` — assert a `gain-resource` attack node with
  `sourceCardId` set pushes exactly `Player <id>'s <cardId> gained +<N> attack.`;
  a recruit node pushes the `recruit` form; a node with `sourceCardId` undefined
  pushes the no-card form; a node evaluating to `0` still pushes a `+0` line; and
  a Berserk-shaped `sequence` (move-card then gain-resource) pushes the grant
  line with the sequence's source card. Preserve the existing
  no-throw-on-missing-`messages` guarantee (a fixture `G` without a `messages`
  array does not throw).

### §D — Sentinel trajectory oracle (expected unchanged)

Re-run `runFixture` for `sentinel-core-doom-2p.replay.json` and confirm
`expected.messages` + `expected.snapshotPerTurn[].messages` are **byte-identical**
(the trajectory has no composition-marker card, so no grant line appears).
`expected.finalStateHash` + `expected.outcome` are unchanged regardless. If a
grant line DOES appear (a composition card is unexpectedly in the trajectory),
re-pin `messages` + `snapshotPerTurn[].messages` only — the hash stays
byte-identical (the WP-294/D-24081 payoff).

## Out of Scope

- **The condition-gated `[hc:X]:` empowered forms' evaluation** — those are
  correctly gated by class/team synergy (WP-295 already logs their skip as `…
  did not activate …`); this packet does not touch the gate, only the grant log
  on the path that DID run.
- **Legacy `HeroEffectDescriptor` handlers** (`heroEffects.execute.ts`) — they
  already log where they log (e.g. `Count-scaled attack: +N`, D-24016); this
  packet touches only the composable `EffectNode` interpreter.
- **`move-card` / `sequence` step logging** — only the `gain-resource` grant is
  logged; a Berserk discard-move line is out of scope (the grant line names the
  net Attack, which is the player-relevant outcome).
- **Naming the mechanic** ("(Empowered)") in the copy — the interpreter is
  mechanic-agnostic; the source card ext_id + the preceding WP-295 `played` line
  + the WP-315 diagnostic ability text supply the mechanic context.
- **No change to `hashGameState.ts` / `replay.hash.ts` / `computeStateHash`** —
  the hash surface (WP-294) is untouched.
- **No new `notableEvents`** — the typed-event channel is not extended.
- **No UI/client change** — the arena client already renders `UIState.log`.
- Refactors or "while I'm here" cleanups are out of scope.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/hero/effectPrimitive.interpret.ts` | **Modified** — `sourceCardId` param on the handler signature + `interpretHeroPrimitiveEffect`; grant log in `interpretGainResourceNode`; forward through `interpretSequenceNode` |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — pass `hook.cardId` at the `interpretHeroPrimitiveEffect` call |
| `packages/game-engine/src/moves/drawOrEmpowered.resolve.ts` | **Modified** — pass the source cardId (or `undefined`) at the resolve-path call |
| `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` | **Modified** — grant-log assertions (attack / recruit / no-card / +0 / Berserk sequence / no-throw-on-missing-messages) |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **Modified ONLY IF the trajectory contains a composition card** — re-pin `messages` + `snapshotPerTurn[].messages` (hash unchanged); expected NO change |
| `docs/ai/DECISIONS.md` | **Modified** — D-24103 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-317 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-347 row |

No other files may be modified. If a composition-effect test elsewhere (e.g. a
Berserk or Empowered test that asserts an exact `G.messages` array) newly fails
because of the added grant line, that is an **in-scope EC amendment** — add the
grant line to that test's expectation and record the added file in the EC; do NOT
suppress the log to keep the test green.

## Non-Negotiable Constraints

### Engine-wide

- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+; `node:` prefix on built-ins; `.test.ts` test files;
  `node:test`/`node:assert` only; no `boardgame.io` import in pure helpers/tests.
- Moves never throw; `G` stays JSON-serializable; determinism preserved
  (messages are deterministic strings).
- Human-style code — `docs/ai/REFERENCE/00.6-code-style.md`; every push has a
  `// why:` comment.

### Packet-specific

- `hashGameState.ts` / `replay.hash.ts` LOCKED — not modified (WP-294 owns the
  hash surface). The sentinel `finalStateHash` MUST stay byte-identical.
- The grant log uses the **ext-id** form for the card (`Player <id>'s <ext-id>
  gained +<N> <resource>.`), matching the WP-295 `… did not activate …` and
  `recruited <ext-id>` conventions — never a display name.
- The interpreter stays **mechanic-agnostic**: the copy names no mechanic.
- The source cardId is execution provenance ONLY — it is never written to `G`,
  `ctx`, a binding, or the `EffectExecutionContext` map (D-24029 §9 replay
  invariant preserved).
- No `.reduce()`; no new dependency; the log push reuses the existing
  array-guard (`Array.isArray(G.messages)`) so a narrow fixture `G` never throws.

### Session protocol

- If a locked file (`hashGameState.ts`, `replay.hash.ts`) appears to need
  modification, STOP — that is WP-294's surface.
- If threading `sourceCardId` appears to require a change to
  `EffectExecutionContext`'s type or to `G`, STOP and re-scope — the param is a
  plain function argument, not state.

### Locked contract values

- Grant line (card known): `` `Player ${playerID}'s ${sourceCardId} gained +${amount} ${resource}.` ``
- Grant line (card unknown): `` `Player ${playerID} gained +${amount} ${resource}.` ``
- `${resource}` ∈ { `attack`, `recruit` } (the closed `EffectResourceKind`).
- Sentinel `finalStateHash` (unchanged): `7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`

## Vision Alignment

- **Vision clauses touched:** §14 (observability / the game explains itself), §8 /
  §22 (determinism + replay — the `messages` oracle), §10 (player-facing log copy).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  The log lines are deterministic and additive; they change no gameplay outcome.
- **Non-Goal proximity check:** none of NG-1..7 crossed — a diagnostic log line is
  neither a paid advantage nor a persuasive surface.
- **Determinism preservation:** deterministic and replay-faithful.
  `finalStateHash` is byte-unchanged (WP-294/D-24081 excludes the log); the
  dedicated `messages` oracle tracks any new lines; `computeStateHash`
  (run-vs-run / desync) sees identical messages on both sides.

## Acceptance Criteria

1. A composable `gain-resource` **attack** node with a defined source card
   appends exactly `Player <id>'s <ext-id> gained +<N> attack.` to `G.messages`
   (asserted in `effectPrimitive.interpret.test.ts`).
2. A **recruit** node appends the `… gained +<N> recruit.` form; a node with an
   undefined source card appends the no-card form; a node evaluating to `0`
   appends a `+0` line.
3. A Berserk-shaped `sequence` (move-card → gain-resource) appends the grant line
   naming the sequence's source card.
4. A fixture `G` without a `messages` array does not throw (the array-guard is
   preserved).
5. `hashGameState.ts` / `replay.hash.ts` byte-identical (`git diff` empty); the
   sentinel `finalStateHash` is byte-unchanged (`7bb990fc…`).
6. `pnpm --filter @legendary-arena/game-engine build` exits 0;
   `pnpm --filter @legendary-arena/game-engine test` exits 0.
7. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: pass, fail 0

# Step 3 — hash surface untouched
git diff HEAD -- packages/game-engine/src/test/fixtures/hashGameState.ts packages/game-engine/src/replay/replay.hash.ts
# Expected: empty

# Step 4 — sentinel finalStateHash unchanged
git diff HEAD -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json | Select-String "finalStateHash"
# Expected: no +/- line for finalStateHash (messages expected unchanged too)

# Step 5 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0
- [ ] `hashGameState.ts` + `replay.hash.ts` byte-identical; sentinel
      `finalStateHash` unchanged (confirmed with `git diff`)
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      live-verify is post-deploy — after merge + deploy, a real match's log panel
      shows a `… gained +N attack.` line when an Empowered/Berserk card resolves;
      until then STATUS.md records the test evidence + the deferred post-deploy
      observation.
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24103 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-317 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-347 flipped to Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present; Out of Scope has ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Layer boundary: game-engine only; interpreter imports no framework/registry; hash surface (WP-294) untouched |
| 3 | ✅ PASS | §Assumes lists WP-294/D-24081 + WP-295/D-24082 + the D-24029 substrate + the exact call sites + baseline commit `6c64d920` |
| 4 | ✅ PASS | Determinism: messages hash-excluded (D-24081); deterministic strings; sentinel hash byte-identical; `computeStateHash` sees identical messages |
| 5 | ✅ PASS | Persistence: no snapshot/DB; `G.messages` runtime-only, already projected; source cardId never persisted |
| 6 | ✅ PASS | Contract files: no `.types/.validate/.gating` field change; adding a function param is an internal signature, authorized via D-24103 |
| 7 | ✅ PASS | Canonical arrays: `EFFECT_NODE_TYPES` / `EffectResourceKind` unchanged; no drift array edited |
| 8 | ✅ PASS | Move contract: no new move; interpreter runs inside the existing play path; nothing throws (array-guard preserved) |
| 9 | ✅ PASS | Naming: `sourceCardId` full words; ext-id log form; boolean/loop-var rules N/A |
| 10 | ✅ PASS | `.reduce()` ban: none introduced |
| 11 | ✅ PASS | `// why:` on the new param (provenance-only), the grant push, and the `+0` rationale |
| 12 | ✅ PASS | Error handling: reuse `Array.isArray(G.messages)` guard; no I/O; no throw; full-sentence message |
| 13 | ✅ PASS | Tests: `.test.ts`, `node:test`/`node:assert`, no `boardgame.io`; non-vacuous assertions on exact strings |
| 14 | ✅ PASS | §Files ↔ EC §Files to Produce align; the conditional sentinel + amendment rule stated |
| 15 | ✅ PASS | No invented mechanics — reports an existing grant; no new effect/keyword/counter |
| 16 | ✅ PASS | Duplicate-first: reuses `pushPrimitiveWarning`'s array-guard pattern; no premature abstraction |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§8/§22/§10; no conflict; determinism-preservation line |
| 18 | ✅ PASS | Verification uses file-path git diffs + `finalStateHash` grep; no forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact authored |
| 20 | ✅ N/A | No funding/monetization surface — a diagnostic game-log line |
| 21 | ✅ N/A | No HTTP endpoint or `apps/server` library function touched |

**Verdict: 21/21 resolved (18 PASS, 3 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Dependencies verified on `main` (`6c64d920`): WP-294/D-24081
(messages excluded from the hash), WP-295/D-24082 (the play/skip-logging sibling
this extends), and the D-24029/D-24044 composable substrate with
`interpretGainResourceNode` as the confirmed silent grant site. The one real risk
— perturbing the replay hash — is foreclosed by the hash exclusion (the change is
`G.messages`-only) and the sentinel-`finalStateHash`-unchanged gate. The source
cardId is a plain function argument (provenance), never state, so the D-24029 §9
replay invariant is preserved. Single layer, additive, narrow surface. Standard
two-session lane (a small exported-signature thread across three call sites keeps
it just outside the lightweight lane).

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing, no monetization/identity/RNG, no new keyword or
contract type. The only mutation is an additive `G.messages` line on the
composable grant path; the hashed surface (`finalStateHash`, `notableEvents`) is
untouched, gated by the sentinel-hash-unchanged acceptance criterion. The
mechanic-agnostic invariant is respected (no mechanic name in the copy). The
`+0`-logs-too decision is deliberate (it explains a zero-count composition, a
cause WP-295's condition-skip line does not cover). No BLOCK modes; the
signature-thread size is the noted RISK, mitigated by the standard-lane split.
