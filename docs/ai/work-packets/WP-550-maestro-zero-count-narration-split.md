# WP-550 — Maestro Zero-Count Narration Fidelity

**Status:** Draft 2026-08-15
**Layer:** Game Engine (`packages/game-engine`) — single layer, 2 code/test files
**Depends on:** WP-544 / EC-579 / D-24353 (the `ko-heroes-current-count-by-trait`
handler this refines) · WP-485 / D-24290 (the `ko-heroes-current-by-trait`
narration precedent) · D-24081 (the `finalStateHash` messages carve-out)
**Reserves:** EC-585 · D-24359
**Baseline:** `origin/main` @ `0e336ff144d6ff826e2f8bb99a5d81c23c15f470`
**Lane:** Standard two-session. **Lightweight-lane eligible** (see §3) — the
executor MAY collapse it per `01.0a §Lightweight Lane` after running the
required scaffold.
**Filename note:** the file slug keeps the reserved `…-narration-split` name
(the ledger reservation key); the design was corrected from *split* to
*replace* at drafting — see §3.

---

## 1. Goal

When Maestro's Fight ability does nothing, the game log should say **why**.
Today it reads `Fight effect: no Heroes to KO.` — which sounds like "you had
nothing left to lose," when the truth is always "you had no Strength Heroes, so
Maestro asked for nothing." Replace that message with one that names the trait.

## 2. Assumes

- **WP-544 / EC-579 / D-24353** shipped `ko-heroes-current-count-by-trait` and
  `villainEffectKoHeroesCurrentCountByTrait`, including its three locked
  narration strings. Merged and live-verified on both branches 2026-08-15.
- **WP-485 / D-24290** — the sibling `villainEffectKoHeroesCurrentByTrait`
  narrates its zero case by naming the trait
  (`KO'd 0 of your shield Hero(es).`, outcome `blocked`,
  `villainEffects.execute.ts:2107`). That is the fidelity precedent.
- **D-24081** — its actual title is *"The Message Log Is Excluded From the
  `finalStateHash` Oracle …; `notableEvents` and `computeStateHash` Stay
  Unchanged."* See §4 for the precise (and narrower) hash consequence.
- No committed fixture fights Maestro (verified at WP-544 execution).
- **Sequencing with WP-549.** Both were drafted in one SPEC PR. Their *code* is
  fully disjoint (`packages/game-engine` vs `apps/registry-viewer`) and they may
  execute in either order, but they share five governance files and both run
  `pnpm roadmap:counts:write`. Execute **sequentially**; the second to land
  rebases onto the first, re-anchors its `DECISIONS.md` append on the
  newly-landed prior entry, and re-runs `roadmap:counts:write`.

## 3. Context

Surfaced by WP-544's own live verification (match `NPyIIWIjd1Q`, 2026-08-15).
Player 0 fought Maestro holding two Ranged Heroes and two basic S.H.I.E.L.D.
Agents; `owed = 0`, the handler correctly took its reachable-no-op branch, and
the log read `[blocked] 18.2.7 Fight effect: no Heroes to KO.`

The **behavior** is right; the **message** doesn't explain itself. Maestro's
other two lines both name the trait (`one per your {requireValue} Hero`) — only
the blocked branch drops it, so the one case where the player most needs a
reason is the one case that withholds it.

### Why this is a *replace*, not a *split* (pre-flight finding, 2026-08-15)

This WP was first drafted as a **split** of the blocked branch into two
messages — `owed === 0` versus "owed but no eligible KO target." Pre-flight
proved the second case is **unreachable**, so the split was designed around a
state that cannot occur. The proof:

1. `countPlayerHeroesMatchingTrait` (`:1480`) counts only ids in
   `hand ∪ inPlay` whose `G.cardTraits[id]` matches the predicate. So
   `owedFromTrait ≥ 1` implies at least one such card exists in those zones.
2. `buildKoEligibleTargets` (`:3174`) emits one target per `(zone, cardId)`
   across `discard / hand / inPlay`, excluding **only** `WOUND_EXT_ID` — and a
   wound token never carries a `cardTraits` entry.
3. Therefore **every Hero that contributes to the count is itself KO-eligible**:
   `owedFromTrait ≥ 1 ⟹ eligible.length ≥ 1`, and the `eligible.length === 0`
   break never fires on the first iteration.
4. The park-break and the park condition are the **same** conjunction with no
   intervening mutation, so breaking there always parks → `neutral`.
5. The one remaining `owed > 0` exit — the defensive `koSingleTarget(...) ===
   null` break — is itself unreachable: `moveCardFromZone` searches the same
   zone the id was read from in the same iteration, so the lookup always hits.
6. Every other `owed > 0` end-state has KO'd at least one Hero → `applied`.

So `blocked` has exactly **one** reachable trigger: `owedFromTrait === 0`. The
correct fix is therefore simpler than the original draft — **replace** the one
message rather than split it. This also removes the risk of enshrining a false
claim in a `// why:` comment and of writing an untestable acceptance criterion.

**Why now.** The handler is fresh, its live behavior is confirmed on both
branches, and no other WP is touching the file.

**Lightweight-lane eligibility.** Single layer, two files, copy-only, no
contract file, no new abstraction or builder, one scoped D-entry, and no
scoring / identity / multiplayer / RNG surface. Drafted under the standard lane
because this drafting session ran no scaffold; an executor who runs one may
collapse it to a single session.

## 4. Determinism and hash surface (precise)

The loose phrase "`G.messages` is hash-excluded" — which appears in existing
handler comments and in D-24353 — is **imprecise**, and this WP does not repeat
it. The accurate position:

- `hashGameState` (`src/test/fixtures/hashGameState.ts`), the
  **`finalStateHash`** oracle, excludes `messages`. ✅
- `computeStateHash` (`src/replay/replay.hash.ts`) excludes **only**
  `diagnostics`; `messages` **stays hashed**, and a live test
  (`replay.hash.test.ts`, *"computeStateHash still hashes messages"*) asserts
  exactly that. `PRE_WP080_HASH` is produced by this oracle.

**No re-pin arises anyway**, for two independent reasons: the `PRE_WP080`
replay runs `moves: []` against a card-less mock registry, so this handler
never fires in it; and no committed fixture fights Maestro. Both must hold, and
both are verified in §9.

## 5. Scope (In)

- Replace `villainEffectKoHeroesCurrentCountByTrait`'s single `blocked` message
  with one that names the trait, per the D-24290 precedent.
- Retarget the two existing tests that assert the old string, and add one new
  empty-zones test (AC-2).
- Keep the branch a reachable no-op (never hollow) and keep outcome `blocked`.

## 6. Scope (Out)

- **No change to the `applied` or `neutral` messages.** Byte-identical; their
  existing tests must pass **unmodified**.
- **No control-flow change.** The `while (owed > 0)` loop, the park condition,
  the omit-`remaining`-when-1 line, the guards, and the
  `return parked ? { targets, pending: true } : { targets }` are untouched.
- **No change to `villainEffectKoHero`, `ko-heroes-current-by-trait`, or any
  other handler.** Note `villainEffects.execute.ts:890` emits a byte-identical
  string on the Whirlwind magnitude path — it is **out of scope** and must keep
  its wording.
- No new primitive, descriptor field, `G` field, pending-choice, UIState field,
  or client change. No `LOG_OUTCOMES` change.
- **Not** a general audit of other handlers' blocked-message fidelity — a
  follow-on if wanted, deliberately not bundled.

## 7. Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/villain/villainEffects.execute.ts` | One `pushLog` message replaced |
| `packages/game-engine/src/villain/villainEffects.execute.test.ts` | Retarget the **two** existing assertions that carry the old string (`:1559-1568`, `:1582-1595`) **and add one new empty-zones case** for AC-2 |

`01.5` runtime wiring: none anticipated.

## 8. Contract

| Condition | Message | Outcome |
|---|---|---|
| parked | *(unchanged)* `Fight effect: KO {owed} of your Heroes (one per your {requireValue} Hero) — choose which.` | `neutral` |
| auto-KO'd ≥ 1 | *(unchanged)* `Fight effect: KO'd {n} of your Heroes ({names}) — one per your {requireValue} Hero.` | `applied` |
| `owedFromTrait === 0` (the sole reachable blocked state) | **replaced** — see EC-585 Locked Values for the exact string | `blocked` |

The exact wording is **locked in EC-585 §Locked Values**; the executor does not
choose it.

**Supersedes the narration clause of D-24353 only.** Everything else D-24353
locked — the primitive name, the trait-supplies-the-COUNT semantic, the
duplicated `ko-hero` park loop, the guards, the return shape — is unchanged.

## 9. Acceptance Criteria

- **AC-1** A player holding Heroes but **no** trait-matching Hero logs the new
  trait-naming message with outcome `blocked`.
- **AC-2** A player whose zones **exist but are empty** logs the same message,
  outcome `blocked` (still the `owedFromTrait === 0` path). Build it with
  `makeMaestroG([])` — a `G` with **no** `playerZones[currentPlayer]` entry
  instead takes the handler's `if (!zones)` early return, which logs nothing and
  would fail AC-2 and AC-3 for an unrelated reason.
- **AC-3** Neither case records a hollow effect
  (`G.diagnostics.hollowEffects` stays empty).
- **AC-4** The `applied` and `neutral` messages are byte-identical to their
  WP-544 form, and their existing tests
  (`villainEffects.execute.test.ts:1514-1528`, `:1543-1550`) pass **unmodified**.
- **AC-5** `villainEffects.execute.ts:890` (the Whirlwind magnitude path) still
  emits its original string; its test at `:705` passes unmodified.
- **AC-6** No `G` shape change; no hash-pin file appears in `git status`;
  `replay.hash.test.ts` and the `PRE_WP080_HASH` replay tests pass unmodified.
- **AC-7** `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0
  (baseline **2612**, expected 2612 + ~1), and `pnpm -r build` +
  `pnpm -r --no-bail test` exit 0.

## 10. Verification Steps

1. `pnpm install && pnpm -r build` in the execution worktree **first** — a
   fresh worktree has no `node_modules` and an absent `dist` reports as failing
   tests.
2. `pnpm --filter @legendary-arena/game-engine test` — record the pre-change
   baseline (**2612 / 619 suites / 0 fail**) before editing.
3. `git diff --stat` shows exactly two non-governance files.
4. `git diff` on the handler shows only the one `pushLog` argument changed.
5. `git status` shows no hash-pin file.

## 11. Definition of Done

- AC-1..AC-7 all pass.
- D-24359 landed (Active); STATUS, WORK_INDEX, EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-585:` (implementation) + `SPEC:` (governance).
- `User-Visible Surface = play.legendary-arena.com` (the game log) —
  **D-24026 live-verify required**: fight Maestro holding no Strength Hero and
  confirm the log names the trait.

## Gate Record (Phase 1)

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | Three rounds. Round 1 NOT READY — PS-1 proved the originally-drafted second branch UNREACHABLE, forcing the split→replace redesign recorded in §3; PS-2 corrected the hash claim (§4); PS-3 two tests carry the old string, not one. Round 2 NOT READY — the rewrite had not propagated to WORK_INDEX / EC_INDEX / mindmap / NUMBER-LEDGER, which still instructed the rejected split. Round 3 READY, with the added `koSingleTarget === null` proof clause confirmed load-bearing (had that break been reachable it would have been a second `blocked` trigger, breaking the replace design). |
| Copilot (`01.7`) | **RISK → resolved** (2026-08-15) | 5 findings applied; re-run left 1 residual (R3, a stale Failure Smell contradicting the rewritten Required-Comments premise), since corrected. Load-bearing catch: nothing byte-pinned the locked string — all three affected assertions are `assert.match`, so a loose retarget could ship wrong capitalization or a hyphen for the em dash. One test now asserts exact equality. |
| Lint gate (`00.3`) | **PASS** | All 21 sections resolved in `## 12. Lint Gate Self-Review`; §17 explicitly **N/A** with a per-trigger walk of `00.3 §17.1`. |

## 12. Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS |
| 2 | Non-Negotiable Constraints Block | PASS — §6 Scope (Out) + EC Guardrails |
| 3 | Prerequisites (`## Assumes`) | PASS — §2, all shipped |
| 4 | Context References | PASS — §3 cites WP-544, D-24290, the live match |
| 5 | Output Completeness | PASS — §7, two files, both verified to carry the string |
| 6 | Naming Consistency | PASS — `requireKind` / `requireValue` unchanged |
| 7 | Dependency Discipline | PASS — WP-544 merged + live-verified |
| 8 | Architectural Boundaries | PASS — `packages/game-engine` only |
| 9 | Windows Compatibility | N/A — no path/shell work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A |
| 12 | Test Quality | PASS — §9 AC-1..AC-7; baseline count (2612) locked in §10 |
| 13 | Commands and Verification | PASS — §10, install-and-build first |
| 14 | Acceptance Criteria Quality | PASS — every AC is assertable; the unreachable-branch AC was removed per §3 |
| 15 | Definition of Done | PASS — §11 |
| 15.1 | User-visible verification (D-24026) | PASS — §11, live-verify required |
| 16 | Code Style | PASS — one string argument; no new abstraction |
| 17 | Vision Alignment | **N/A** — triggers none of the §17.1 surfaces: no scoring/PAR/leaderboard, no replay storage, no identity, no multiplayer sync, no determinism or RNG sourcing change (§4), no card **data** change (log copy is not card text), no monetization, no live-ops gate, no accessibility surface, not a Registry Viewer surface. Stated explicitly per §17.1's "silent omission is a FAIL." |
| 18 | Prose-vs-Grep Discipline | PASS — EC's diff-grep gate is scoped to non-comment lines so the required `// why:` comments cannot self-trip it |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA pinned in the header; WP-544 is on `main` |
| 20 | Funding Surface Gate | N/A — no funding/monetization surface |
| 21 | API Catalog Update (D-11804) | N/A — no HTTP endpoint and no `apps/server` library function |
