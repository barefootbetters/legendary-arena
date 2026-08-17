# WP-567 — Red Skull Tactic onFight Resolvers (Game Engine)

**Status:** Drafted 2026-08-17
**EC:** [EC-602](../execution-checklists/EC-602-red-skull-tactic-onfight-resolvers.checklist.md)
**Reserves:** D-24376
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `752a3d66`

---

## Goal

Make defeating a Red Skull Mastermind Tactic do what the card says. All **four**
of Red Skull's tactics currently have no `onFight` resolver, so a player who
defeats one receives none of its printed effect — and sees no log line saying
anything was skipped. This packet implements the three non-interactive tactics
and their log lines.

## Assumes

- **WP-497 / D-24300** — the Mastermind Tactic `onFight` execution framework.
  `dispatchTacticOnFight(G, ctx, defeatedTacticId)` in
  `packages/game-engine/src/rules/tacticHandlers.ts` is the dispatch point.
- **WP-506** — core Magneto's *Crushing Shockwave*, the per-tactic resolver
  precedent this WP copies. Read it before writing a new resolver.
- **WP-507** — mastermind-tactic coverage in the effect-implementation index.
- **The framework's current coverage is exactly two resolvers**
  (`OCTET_TACTIC_ID`, `MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID`); unhandled ids fall
  through to a silent no-op. Verified at source during drafting.
- **The sentinel fixture is `core/dr-doom`**, not Red Skull — read from
  `sentinel-core-doom-2p.replay.json` `input.setupConfig.mastermindId`.

## Context

**Reported from a real match.** A solo Red Skull / Super Hero Civil War game at
`gitSha 47e5162` defeated all four tactics across 19 turns and received nothing
from any of them. The miss is provable from that match's diagnostics:
`economy.recruit` ended at **5** — exactly Officer +2 / Agent +1 / Surge of Power
+2 — with no trace of *Endless Resources*' printed **+4 recruit**.

**The framework is not the gap; the resolvers are.** WP-497 built the dispatch
and WP-506 proved the per-tactic pattern. Red Skull was simply never wired in.

**The silence is half the defect.** `dispatchTacticOnFight` returns without a log
line for an unhandled tactic, so a player gets no indication an effect was
skipped. Every resolver this WP adds logs its effect, and the WP records that an
unimplemented tactic's silence is itself a defect (D-24376 §1) — though it does
**not** convert the fallthrough into a throw, because other masterminds' tactics
are deliberately still inert.

**Why *Ruthless Dictator* is excluded.** Its printed effect ("look at the top
three cards of your deck, KO one, discard one, put one back on top") is
**interactive** — it parks a pending choice. A parked choice shipped without its
`UIState` projection and prompt **hard-freezes the human player**, which is a
shipped, known failure class in this repo. Folding it in would make this packet a
projection + prompt + move + bot-enumeration change on top of three trivial
resolvers. It is deferred to its own packet, named in §Notes.

## Scope (In)

1. `rules/tacticHandlers.ts` — three new resolvers plus their dispatch branches:
   - `core-mastermind-red-skull-negablast-grenades` → +3 attack
   - `core-mastermind-red-skull-endless-resources` → +4 recruit
   - `core-mastermind-red-skull-hydra-conspiracy` → draw 2, then one more card
     per HYDRA Villain in the defeating player's Victory Pile
2. A log line per resolved effect, via `pushLog`, with the correct
   `LOG_OUTCOMES` colour.
3. Tests for each resolver, including the count-scaled draw at 0 and at N
   HYDRA Villains.

## Scope (Out)

- **`core-mastermind-red-skull-ruthless-dictator`** — interactive; its own packet.
- Converting `dispatchTacticOnFight`'s unhandled fallthrough into a throw or a
  warning. Other masterminds' tactics stay deliberately inert.
- Any other mastermind's tactics.
- Any new `RuleEffectType`. These three are expressible with existing primitives.
- Any card-data change. The four tactic ability texts are already correct.
- The Master Strike bystander-capture log gap observed in the same match
  (D-15401 specified a message only for the empty-supply case) — recorded in
  §Notes.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | 3 resolvers + 3 dispatch branches + tactic-id constants |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | extend — per-resolver + count-scaled draw cases |

## Contract

**Locked — the three tactic ext_ids and their effects (D-24376 §2).**

| ext_id | Printed Fight effect | Shape |
|---|---|---|
| `core-mastermind-red-skull-negablast-grenades` | You get +3 attack | flat economy |
| `core-mastermind-red-skull-endless-resources` | You get +4 recruit | flat economy |
| `core-mastermind-red-skull-hydra-conspiracy` | Draw two cards, then draw another for each HYDRA Villain in your Victory Pile | count-scaled draw |

**Locked — each resolved effect LOGS.** The current silent no-op is half the
defect; a resolver that mutates without a log line is a FAIL.

**Locked — the count for HYDRA Conspiracy is HYDRA Villains in the DEFEATING
player's Victory Pile**, counted through the existing victory-pile helper rather
than a new counting copy.

**Locked — dispatch stays per-ext_id with a silent fallthrough.** The shape is
extended, not replaced.

> **Determinism — NO re-pin expected.** The sentinel fixture is `core/dr-doom`,
> so no Red Skull tactic resolves in it, and `PRE_WP080_HASH` replays an empty
> state. Both oracles are expected **byte-unchanged**. Verify rather than assume;
> if either moves, STOP and find out why before re-recording anything.

## Acceptance Criteria

- **AC-1** — defeating *Negablast Grenades* grants exactly +3 attack and logs it.
- **AC-2** — defeating *Endless Resources* grants exactly +4 recruit and logs it.
- **AC-3** — defeating *HYDRA Conspiracy* with **0** HYDRA Villains in the
  victory pile draws exactly **2**; with **3** HYDRA Villains it draws **5**.
- **AC-4** — the HYDRA count reads the defeating player's victory pile only; a
  second player's HYDRA Villains do not inflate it.
- **AC-5** — *Ruthless Dictator* remains a no-op and is **not** dispatched, and a
  test pins that (so a later packet's arrival is deliberate, not accidental).
- **AC-6** — the two pre-existing resolvers (*Octet of Valence Electrons*,
  *Crushing Shockwave*) are behaviour-unchanged; their tests are untouched and
  green.
- **AC-7** — an unhandled tactic id still takes the silent fallthrough without
  throwing.
- **AC-8** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged**.
- **AC-9** — `pnpm -r build` 0; engine suite green; `pnpm -r --no-bail test` no
  new failures.
- **AC-10** — **D-24026**: a live match defeating *Endless Resources* shows the
  +4 recruit in the HUD economy and a log line naming the effect.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; new resolver tests present and passing.
3. Confirm both hash oracles byte-unchanged.
4. `pnpm -r --no-bail test` → no new failures.
5. Post-deploy: AC-10.

## Definition of Done

- [ ] AC-1..AC-9 demonstrated with observed output; AC-10 verified or recorded
      operator-pending.
- [ ] D-24376 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [ ] `STATUS.md` records both oracles byte-unchanged and names *Ruthless
      Dictator* as the deferred remainder.

## Notes

Two adjacent defects observed in the same match, deliberately **not** fixed here:

1. ***Ruthless Dictator* is deferred** as scoped above — interactive, needs
   projection + prompt + bot enumeration mirror shipped together.
2. **The Master Strike bystander capture is silent.** `mastermindStrikeHandler`
   calls `captureBystanderOntoMastermind` on every strike, and D-15401 specified a
   log line only for the empty-supply case — so the match showed three bystanders
   rescued from the mastermind with only one capture logged. Rules-correct,
   log-incomplete; its own small packet.

## Gate Verdicts

- **Pre-flight (`01.4`):** `READY TO EXECUTE` —
  `docs/ai/invocations/preflight-wp567-red-skull-tactic-onfight-resolvers.md`
- **Copilot (`01.7`):** `PASS` (1 RISK, fixed in place) —
  `docs/ai/invocations/copilot-wp567-red-skull-tactic-onfight-resolvers.md`

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| 1 Goal is one user-visible outcome | PASS |
| 2 Assumes cites each dependency's source | PASS — WP-497 / 506 / 507 + source reads |
| 3 Context states why now | PASS — live match, provable from diagnostics |
| 4 Scope In is a closed enumeration | PASS — three named ext_ids |
| 5 Scope Out is explicit | PASS — Ruthless Dictator named and reasoned |
| 6 Files Expected to Change is an allowlist | PASS — 2 files |
| 7 Contract locks the surface | PASS — ext_id → effect table |
| 8 Acceptance Criteria are testable | PASS |
| 9 Verification Steps are operator-runnable | PASS |
| 10 Definition of Done is binary | PASS |
| 11 Layer boundary respected | PASS — engine only, single package |
| 12 Determinism impact stated | PASS — AC-8, sentinel is dr-doom |
| 13 Persistence boundary untouched | PASS — no snapshot, no DB |
| 14 Observability | PASS — every resolver logs; the silence is named as defect |
| 15 No invented mechanics | PASS — effects read from printed card text |
| 16 Canonical field names | PASS |
| 17 Contract files untouched | PASS — no `.types.ts` / `.validate.ts` / `.gating.ts` |
| 18 Grep-gate prose discipline | N/A — no count-bounded grep gate in this WP |
| 19 Scaffold run for validation-tightening | N/A — additive resolvers; tightens no input path and removes no prop |
| 20 D-24026 named for a user-visible surface | PASS — AC-10 |
| 21 API catalog obligation | N/A — no HTTP endpoint or library-only function changes |
