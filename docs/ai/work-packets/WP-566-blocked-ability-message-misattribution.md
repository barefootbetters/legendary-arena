# WP-566 — Blocked-Ability Message Misattribution (Game Engine)

**Status:** Drafted 2026-08-17
**EC:** [EC-601](../execution-checklists/EC-601-blocked-ability-message-misattribution.checklist.md)
**Reserves:** D-24375
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` (the game log) — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `3a79afb9`

---

## Goal

Make the game log say which gate actually stopped an ability. One generic line —
*"a play condition (such as Hero class or team synergy) was not met"* — is emitted
for **every** hero-hook condition failure, so it is right for two of the four live
condition types and confidently wrong for the other two.

## Assumes

- **WP-295 / D-24082** — the rule that a condition-gated ability must be
  **observable** in the log rather than silently skipped. This WP improves that
  line; it never removes it.
- **WP-434** — the `LOG_OUTCOMES` taxonomy. A suppressed ability stays `blocked`.
- **WP-438** — `LogEntry.card`, already threaded at the emit site.
- **WP-545 / D-24354** — the `recruitMadeThisTurnAtLeast` condition (Surge of
  Power). One of the two types the current message misdescribes.
- **D-24055** — `distinctHeroClassesAtLeast` (Spectrum). The other one.
- **The message is engine-owned copy by existing convention** — every `pushLog`
  string is engine-side. This WP does not move copy across a layer boundary; it
  improves a string the engine already owns. (Client-side *labels* remain
  client-side; that boundary is untouched.)

## Context

**Reported from a real match.** A solo Red Skull / Super Hero Civil War game fired
this message **8 times on Surge of Power**, whose printed text is *"If you made 8
or more recruit this turn, you get +3 attack"* — a recruit threshold with **no
class or team gate at all**. In the same match the identical string was **correct**
for Keen Senses, Odinson and Frenzied Slashing, which really are `[hc:instinct]` /
`[hc:strength]` gates. It is right often enough to look right, which is why it
survived.

**The condition inventory, counted at source.** Four types are constructed by the
parser and six are handled by the evaluator:

| Condition type | Constructed? | Message correct today? |
|---|---|---|
| `heroClassMatch` | yes | yes |
| `requiresTeam` | yes | yes |
| `distinctHeroClassesAtLeast` | yes | **no** — Spectrum's ≥3 distinct classes |
| `recruitMadeThisTurnAtLeast` | yes | **no** — Surge of Power's recruit threshold |
| `playedThisTurn` | never | (handled but unreachable from card data) |
| `requiresKeyword` | never | (handled but unreachable from card data) |

So the message is wrong for exactly the two **numeric-threshold** conditions —
which are also the two whose failure a player could act on (*"one more recruit"*,
*"one more class"*).

**The worse half: `default: false`.** `evaluateCondition`'s `default` branch
returns `false`, and `HeroCondition` is a stringly-typed `{ type: string; value:
string }`. So an **unrecognized** condition type permanently blocks the ability
**and** emits the same class/team wording. A data or parse defect is therefore
indistinguishable in the log from a working synergy gate — the message actively
disguises a class of bug.

## Scope (In)

1. `hero/heroConditions.evaluate.ts` — a **new sibling** function returning the
   first failing `HeroCondition` (or `undefined`), plus a pure helper that
   describes a condition in player terms. `evaluateAllConditions` and
   `evaluateCondition` stay **byte-unchanged** (both are exported from `index.ts`).
2. `hero/heroEffects.execute.ts` — the emit site names the failed condition.
3. `index.ts` — export the new function + helper.
4. Tests for every message variant, including the unrecognized-type path.

## Scope (Out)

- **Changing whether an ability fires.** No gate evaluation changes. `default:
  false` **stays** (fail-closed: never fire an effect whose gate cannot be
  evaluated) — only its *log line* becomes distinguishable.
- Removing or weakening the line (D-24082 keeps it observable).
- Changing the `blocked` `LOG_OUTCOMES` colour.
- Any wait-and-see / retroactive re-evaluation semantics — that is **WP-568**, and
  it depends on this WP's "not yet met" vs "failed" distinction. See §Notes.
- `playedThisTurn` / `requiresKeyword` — described for completeness but not
  reachable from card data; no parser change here.
- Any client change. The log renders whatever the engine emits.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/hero/heroConditions.evaluate.ts` | new sibling resolver + describe helper; existing exports untouched |
| `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` | extend — one case per condition type + unrecognized |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | emit site names the failed condition |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | extend — per-variant message assertions |
| `packages/game-engine/src/index.ts` | export the new function + helper |

## Contract

**Locked — the message names the condition that FAILED (D-24375 §1).** For a
multi-condition hook the named condition is the **first failing** one, matching
`evaluateAllConditions`' existing short-circuit order.

**Locked — an UNRECOGNIZED type reads differently from an unmet one (D-24375 §3).**
Its line must say the condition could not be evaluated and name the offending
`type` string. Behaviour is unchanged (still blocked, fail-closed); only the log
distinguishes a data defect from gameplay.

**Locked — the existing exported evaluators are byte-unchanged.**
`evaluateCondition` and `evaluateAllConditions` are public via `index.ts`; the new
behaviour arrives as a sibling, not a signature change.

> **Determinism — no re-pin expected, and here is the mechanism.** Two hashes
> treat messages differently and both are safe:
> - the sentinel `finalStateHash` uses `hashGameState`, which **excludes**
>   `messages` (D-24081) → unchanged;
> - `PRE_WP080_HASH` uses `computeStateHash`, which **does** hash `messages` — but
>   it replays an **empty** move list, so no hero ability is played and no blocked
>   message is emitted → unchanged.
>
> Verify both rather than assume. If either moves, **STOP**.

**Recorded, not a blocker — message text lives inside the competitive hash.**
`computeStateHash` hashes `messages`, and it is the anti-tamper anchor for
competitive submissions. This is safe because the only comparison
(`competition.logic.ts`: `reduced.stateHash !== replayHash`) computes **both
sides at submission time under the same code**, and no stored `state_hash` is ever
re-verified against a fresh replay. Every prior log-text WP (WP-417 / D-24237,
WP-434, WP-438) has the same property. Stated so the executor does not mistake it
for a blocker.

## Acceptance Criteria

- **AC-1** — a failed `recruitMadeThisTurnAtLeast` names the recruit threshold and
  the actual recruit made; the words "Hero class" and "team synergy" do **not**
  appear.
- **AC-2** — a failed `distinctHeroClassesAtLeast` names the required and actual
  distinct-class counts.
- **AC-3** — a failed `heroClassMatch` names the required class; a failed
  `requiresTeam` names the required team. These are the two the old message got
  right and they must stay right.
- **AC-4** — an **unrecognized** condition type produces a line saying the
  condition could not be evaluated and naming the `type` string, distinct from
  every "not met" line; the ability is still blocked.
- **AC-5** — for a hook with two failing conditions, the message names the
  **first** in `hook.conditions` order.
- **AC-6** — the outcome stays `blocked` and `LogEntry.card` still carries the
  played card for every variant.
- **AC-7** — `evaluateCondition` and `evaluateAllConditions` are byte-unchanged
  (`git diff` shows no edit to either function body).
- **AC-8** — no gate evaluation changes: a suite of states that fired before still
  fire, and states that blocked before still block.
- **AC-9** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged**.
- **AC-10** — `pnpm -r build` 0; engine suite green; `pnpm -r --no-bail test` no
  new failures.
- **AC-11** — **D-24026**: in a live match, a Surge of Power blocked at <8 recruit
  and a class-gated ability blocked with no matching class show **different**
  reasons in the game log.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; per-variant message tests present.
3. `git diff` on `heroConditions.evaluate.ts` shows the two existing functions
   untouched.
4. Confirm both hash oracles byte-unchanged.
5. `pnpm -r --no-bail test` → no new failures.
6. Post-deploy: AC-11.

## Definition of Done

- [ ] AC-1..AC-10 demonstrated with observed output; AC-11 verified or recorded
      operator-pending.
- [ ] D-24375 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [ ] `STATUS.md` records both oracles byte-unchanged and the competitive-hash
      property explicitly.

## Notes

**Sequencing with WP-568.** WP-568 (wait-and-see conditional semantics) introduces
a *"not yet met"* state, which must **not** reuse this WP's "not met" wording.
WP-566 should land **first**: it establishes the per-condition message vocabulary
that WP-568 then extends with one more state. The two WPs touch the same emit site
and the same evaluator module, so they must **not** execute concurrently.

**Deliberately not fixed here:** the silent Master Strike bystander capture
(D-15401 specified a log line only for the empty-supply case), observed in the same
match. Its own small packet.

## Gate Verdicts

- **Pre-flight (`01.4`):** `READY TO EXECUTE` —
  `docs/ai/invocations/preflight-wp566-blocked-ability-message-misattribution.md`
- **Copilot (`01.7`):** `PASS` (1 RISK, fixed in place) —
  `docs/ai/invocations/copilot-wp566-blocked-ability-message-misattribution.md`

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| 1 Goal is one user-visible outcome | PASS |
| 2 Assumes cites each dependency's source | PASS — WP-295/434/438/545 + D-24055 |
| 3 Context states why now | PASS — 8 live firings, inventory counted at source |
| 4 Scope In is a closed enumeration | PASS |
| 5 Scope Out is explicit | PASS — no gate-evaluation change; WP-568 named |
| 6 Files Expected to Change is an allowlist | PASS — 5 files |
| 7 Contract locks the surface | PASS |
| 8 Acceptance Criteria are testable | PASS |
| 9 Verification Steps are operator-runnable | PASS |
| 10 Definition of Done is binary | PASS |
| 11 Layer boundary respected | PASS — engine only; the log string is already engine-owned |
| 12 Determinism impact stated | PASS — both hashes, with the mechanism for each |
| 13 Persistence boundary untouched | PASS — no `G` field, no DB |
| 14 Observability | PASS — this WP is entirely an observability fix |
| 15 No invented mechanics | PASS — no gate changes; message only |
| 16 Canonical field names | PASS |
| 17 Contract files untouched | PASS — no `.types.ts` / `.validate.ts` / `.gating.ts`; the two public evaluators are byte-unchanged |
| 18 Grep-gate prose discipline | N/A — no count-bounded grep gate in this WP |
| 19 Scaffold run for validation-tightening | N/A — tightens no input path; no gate evaluation changes and AC-8 pins that |
| 20 D-24026 named for a user-visible surface | PASS — AC-11 |
| 21 API catalog obligation | N/A — no HTTP endpoint; the new engine exports are not `apps/server` library-only catalog entries |
