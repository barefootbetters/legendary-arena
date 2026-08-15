# EC-585 — Maestro Zero-Count Narration Fidelity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-550-maestro-zero-count-narration-split.md
**Layer:** Game Engine (`packages/game-engine`) — 2 code/test files

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] **Sequencing:** WP-550 and WP-549 were drafted in one SPEC PR and share five governance files (`DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`) plus `pnpm roadmap:counts:write`. Execute them **sequentially, either order** — never in parallel worktrees. If WP-549 landed first, rebase onto it, re-anchor this WP's `DECISIONS.md` append on the newly-landed D-24358 tail, and re-run `roadmap:counts:write` before committing
- [ ] `pnpm install` then `pnpm -r build` in this worktree **first** — a fresh worktree has no `node_modules` / `dist`, and an absent `dist` reports as failing tests
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 at **2612 tests / 619 suites / 0 fail**. Record it; STOP on any other number
- [ ] Handler present: `grep -q "function villainEffectKoHeroesCurrentCountByTrait" packages/game-engine/src/villain/villainEffects.execute.ts`
- [ ] Exactly one blocked message in the handler: `sed -n '/function villainEffectKoHeroesCurrentCountByTrait/,/^}/p' packages/game-engine/src/villain/villainEffects.execute.ts | grep -c "no Heroes to KO"` → **1**
- [ ] Precedent present: `grep -q "of your \${requireValue} Hero(es)" packages/game-engine/src/villain/villainEffects.execute.ts` (the D-24290 zero-case line)
- [ ] Whirlwind twin still present and OUT of scope: `grep -c "effect: no Heroes to KO" packages/game-engine/src/villain/villainEffects.execute.ts` → **2** (the handler's, plus `:890`). After the change this must be **1**

## Locked Values (do not re-derive)
- **Replacement message** (the sole reachable `blocked` state, `owedFromTrait === 0`): `Fight effect: no {requireValue} Heroes — nothing to KO.` — outcome **`blocked`**.
  - It MUST interpolate `requireValue` (Maestro → `strength`). Naming the trait is the whole point; the D-24290 sibling reads `KO'd 0 of your shield Hero(es).`, and Maestro's own `applied` / `neutral` lines already say `one per your {requireValue} Hero`.
  - This **replaces** the old string in this handler — it is not an added branch. See WP §3: the "owed > 0 with no eligible target" state is **unreachable** (every counted Hero is itself KO-eligible, since `buildKoEligibleTargets` excludes only `WOUND_EXT_ID` and a wound never carries a `cardTraits` entry).
- **Unchanged, byte-for-byte:** the parked (`neutral`) and auto-KO'd (`applied`) messages, and the Whirlwind magnitude-path string at `villainEffects.execute.ts:890`.
- **Outcome enum unchanged:** stays `blocked`; no `LOG_OUTCOMES` edit.
- **Hash reality (do NOT restate the loose claim):** `messages` is excluded from **`finalStateHash`** (`src/test/fixtures/hashGameState.ts`) per D-24081, but **stays hashed** by `computeStateHash` (`src/replay/replay.hash.ts`, pinned by the live `replay.hash.test.ts` case *"computeStateHash still hashes messages"*). No re-pin arises because the `PRE_WP080` replay runs `moves: []` against a card-less mock registry and no committed fixture fights Maestro.
- **DECISIONS reservation:** **D-24359**.

## Guardrails
- **Copy only.** Do NOT touch the `while (owed > 0)` loop, the park condition, the `if (owed >= 2) entry.remaining = owed;` line, the guards, or the return. A control-flow diff means you exceeded scope.
- Do NOT touch `villainEffectKoHero` (including its byte-identical string at `:890`), `villainEffectKoHeroesCurrentByTrait`, or any other handler.
- Do NOT add a branch for the unreachable "owed > 0, no eligible target" state, and do NOT write a `// why:` comment asserting that state exists — it does not.
- Do NOT add a primitive, descriptor field, `G` field, pending-choice, UIState field, or client change.
- Do NOT re-pin `finalStateHash` / `PRE_WP080_HASH`; no hash-pin file may appear in `git status`.
- No `ctx.random` / `Math.random`.
- The branch must stay a **reachable no-op**, never a hollow record.
- Do NOT sweep other handlers' blocked messages into this WP (WP §6 Out).
- **Leave the handler's existing D-24081 `// why:` comment byte-identical.** It sits a few lines above the replaced message and carries the loose "`G.messages` is hash-excluded" phrasing WP §4 identifies as imprecise. Correcting it is a separate change — this WP is copy-only on the message itself.

## Required `// why:` Comments
Keep this to **one** comment, placed on the replaced `pushLog` call. Use a `//` **line** comment — the control-flow gate below filters `^[+-]\s*//`, so a line comment cannot self-trip it and **no token restrictions apply**. A `/* */` or JSDoc block comment is **not** filtered and WILL trip the gate; do not use one.
- Cite D-24359, state that this is the **only** reachable blocked state (a counted Hero is always itself KO-eligible), and name the D-24290 precedent as the reason the trait appears in the copy.

## Files to Produce
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — one `pushLog` message
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — (a) retarget the **two** existing assertions that carry the old string: `:1559-1568` (WP-544's zero-match case) and `:1582-1595` (WP-544's discard-out-of-scope case) — note those labels are **WP-544's** AC numbers, not WP-550's; (b) **add one new test** with fully empty zones, covering WP-550 AC-2
- `docs/ai/DECISIONS.md` (D-24359 → Active) — **the landed entry must state the REPLACE design** (`owedFromTrait === 0` is the sole reachable `blocked` state, with the unreachability proof). The NUMBER-LEDGER reservation's body still narrates the abandoned two-branch split; its bracketed `[REVISED 2026-08-15 …]` note is the authoritative part. Do NOT paste the reservation body into `DECISIONS.md` · `docs/ai/STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-550 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] AC-1 (Heroes present, none matching) **and** AC-2 (zones exist but empty — the NEW test) both log `Fight effect: no strength Heroes — nothing to KO.` / `blocked`
- [ ] **At least one** of those tests asserts the string with EXACT equality, not `assert.match`: `assert.equal(G.messages.at(-1)!.text, 'Fight effect: no strength Heroes — nothing to KO.')`. All three existing assertions are regex-based, so a loose retarget like `/no strength Heroes/` would pass while shipping wrong capitalization or a hyphen instead of the em dash
- [ ] AC-3: `G.diagnostics?.hollowEffects?.length ?? 0` is 0 in both
- [ ] AC-4: the `applied` (`:1543-1550`) and `neutral` (`:1514-1528`) assertions pass **with no edit**
- [ ] AC-5: `grep -c "effect: no Heroes to KO" packages/game-engine/src/villain/villainEffects.execute.ts` → **1** (the Whirlwind twin survives); its test at `:705` passes unmodified
- [ ] Control flow untouched — on **non-comment** lines only: `git diff -U0 packages/game-engine/src/villain/villainEffects.execute.ts | grep -E '^[+-]' | grep -v '^[+-][[:space:]]*//' | grep -cE 'while \(|buildKoEligibleTargets|countKoableHeroes|koSingleTarget|entry\.remaining|return '` → **0**
- [ ] `git diff --name-only` shows exactly 2 non-governance files, both under `packages/game-engine/src/villain/`
- [ ] No RNG in the handler: `sed -n '/function villainEffectKoHeroesCurrentCountByTrait/,/^}/p' packages/game-engine/src/villain/villainEffects.execute.ts | grep -c "Math.random\|ctx.random"` → **0** (note: `grep -c` exits 1 on a zero count — do not chain this or the control-flow gate above with `&&`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (**2612 → 2613**, the one added empty-zones test); `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] No hash-pin file in `git status`; `replay.hash.test.ts` passes unmodified
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24359 landed (Active)
- [ ] Commit prefix `EC-585:` (implementation) + `SPEC:` (governance)
- [ ] D-24026 live-verify recorded as pending: fight Maestro holding no Strength Hero; the log names the trait

## Common Failure Smells
- The new line reads `no undefined Heroes` → wrong local; `requireValue` is the normalized trait slug (`strength`), already guarded non-undefined earlier in the handler.
- You added a second blocked branch → the "owed > 0, no eligible target" state cannot occur; a branch for it is dead code and its test would need an impossible `G` (a wound token carrying `heroClass`).
- The Whirlwind test at `:705` goes red → you edited `:890`; that string belongs to `villainEffectKoHero` and is out of scope.
- Only one test needed retargeting → you missed the second (`:1582-1595`, the discard-out-of-scope case also asserts the old string).
- A WP-544 `applied` / `neutral` test needed editing → you changed a locked message.
- `finalStateHash` / `PRE_WP080_HASH` in `git status` → you touched state, not copy.
- The control-flow grep trips on your own `// why:` comment → you used a `/* */` or JSDoc block comment. The gate filters only `//` **line** comments; use one and no token restrictions apply.
