# WP-581 — Visible Cue for the Recruit-as-Attack Conversion (God of Thunder)

**Status:** Draft 2026-08-21 — awaiting execution. **Reserves WP-581 / EC-616 / D-24390.** Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` — after playing God of Thunder, the Economy bar shows a clear, accessible cue that Recruit can be spent as Attack this turn, so the WP-580 conversion is discoverable instead of a silent change in the Attack number. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine` — project the existing WP-580 flag onto `UITurnEconomyState`) + App (`apps/arena-client` — the `EconomyBar` cue). Cross-layer, one WP.
**Dependencies:** WP-580 / D-24389 (the `G.turnEconomy.recruitSpendableAsAttack` flag + `getSpendableAttack`, already on `main`); WP-128 / D-12803 (the active-player-only economy audience filter); WP-575 / WP-562 (the "extend the drift pin for an optional add" lesson); the WP-556 Effect-Intensity / reduced-motion posture. All landed. Baseline `origin/main` at draft: `64bc9591`.

---

## Goal

Make the WP-580 recruit-as-attack conversion **visible**. WP-580 shipped the mechanic — after God of Thunder, `getSpendableAttack` folds unspent recruit into the fight-affordability figure and the `EconomyBar`'s Attack readout rises accordingly — but nothing tells the player *why* their Attack went up or that Recruit is now spendable on fights. The live-verify surfaced exactly this ("no option provided" — the mechanic worked but was undiscoverable). This WP projects the existing `G.turnEconomy.recruitSpendableAsAttack` flag onto the client-visible economy state and renders a small, accessible cue in `EconomyBar.vue` while the conversion is active this turn. Display-only — it changes nothing about how the conversion computes or spends.

## User-Visible Impact

On `play.legendary-arena.com`, once the active player plays God of Thunder, the Economy bar shows a cue on the Attack line — a short badge/label such as "Recruit ⭢ Attack this turn" — for the rest of that turn, and it clears next turn. The cue is accessible: it does not rely on colour alone, carries an `aria-label`, and requires no animation (reduced-motion safe). Non-active players and spectators do not see it (the economy is active-player-only). No change to the conversion math, the Attack/Recruit totals, or any WP-580 behaviour. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The WP-580 flag exists on G.turnEconomy (this WP projects it, does not add it)
grep -q "recruitSpendableAsAttack" packages/game-engine/src/economy/economy.types.ts && echo "A_OK"
# Expected: A_OK

# B. UITurnEconomyState does NOT yet carry the flag (it is being added here)
grep -q "UITurnEconomyState" packages/game-engine/src/ui/uiState.types.ts && ! grep -q "recruitSpendableAsAttack" packages/game-engine/src/ui/uiState.types.ts && echo "B_OK"
# Expected: B_OK

# C. The economy is audience-filtered active-player-only (field-by-field rebuild)
grep -q "REDACTED_ECONOMY" packages/game-engine/src/ui/uiState.filter.ts && grep -q "only the active player sees their own economy" packages/game-engine/src/ui/uiState.filter.ts && echo "C_OK"
# Expected: C_OK

# D. EconomyBar renders the Attack readout (the cue's home)
grep -q "economy.availableAttack" apps/arena-client/src/components/play/EconomyBar.vue && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §"UIState Projection Integrity [Derived Rule]" — the **Board-Visible Field Rule** five-step contract (declare on the type, populate in `buildUIState`, pass through `filterUIStateForAudience`, add an audience-filter test, verify in the Play Diagnostics `uiStateSnapshot`). A field that reaches `buildUIState` but not the filter is silently dropped at the whitelist (the shipped EC-206 failure).
- `docs/ai/DECISIONS.md` — scan **D-24389** (the WP-580 conversion; this WP is its display follow-up), **D-24390** (this WP), **D-12803** (WP-128 economy audience redaction).
- `packages/game-engine/src/economy/economy.types.ts` — `TurnEconomy.recruitSpendableAsAttack?: boolean` (WP-580), lazily materialized on `G.turnEconomy`.
- `packages/game-engine/src/ui/uiState.types.ts` — `UITurnEconomyState` (attack, recruit, availableAttack, availableRecruit, piercing, woundsDrawn). The field is added here.
- `packages/game-engine/src/ui/uiState.build.ts` — builds the economy block (`availableAttack: getSpendableAttack(...)`, WP-580).
- `packages/game-engine/src/ui/uiState.filter.ts` — rebuilds the economy field-by-field for the **active player only** (`audience.kind === 'player' && audience.playerId === activePlayerId`), else `REDACTED_ECONOMY`. The new field must be threaded through the active-player branch.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the drift pin. An optional field added without extending it passes the keyset assertion silently (WP-562 / WP-575).
- `apps/arena-client/src/components/play/EconomyBar.vue` — renders `Attack: {{ economy.availableAttack }}/{{ economy.attack }}` and `Recruit: …`. The cue is added here.
- `docs/01-VISION.md` §10 (play surface), §17 (accessibility — the cue must not be colour-only and must carry an accessible name).

## Scope (In)

### Engine (project the flag — the WP-575 Board-Visible-Field pattern)

1. `ui/uiState.types.ts` — add an optional `recruitSpendableAsAttack?: boolean` to `UITurnEconomyState`.
2. `ui/uiState.build.ts` — populate it in the economy block from `G.turnEconomy.recruitSpendableAsAttack` (omit-when-absent — set it only when `true`, so a non-conversion turn's economy is unchanged).
3. `ui/uiState.filter.ts` — pass it through the **active-player** economy branch (omit-when-absent, conditional assignment — no `recruitSpendableAsAttack: undefined` literal). `REDACTED_ECONOMY` (non-active players + spectators) does **not** carry it.
4. `ui/uiState.filter.test.ts` — audience-filter test: the field survives for the active player when set, is absent when unset, and is never present for non-active players / spectators.
5. `ui/uiState.types.drift.test.ts` — **extend the drift pin as a RUNTIME keyset assertion on a BUILT economy projection**, NOT a hand-written-literal append. Build a `gameState` with `turnEconomy.recruitSpendableAsAttack = true`, run `buildUIState`, and assert the projected (active-player) economy keyset contains `recruitSpendableAsAttack` — mirroring the effectTraces built-projection pin already in this file (the WP-562 / WP-575 lesson: appending the field to the hand-written `UITurnEconomyState` literal pins its *name* but does NOT catch `buildUIState`/filter silently dropping an omit-when-absent optional field; only a keyset assertion on a built projection does).

### Client (render the cue)

6. `apps/arena-client/src/components/play/EconomyBar.vue` — when `economy.recruitSpendableAsAttack` is true, render a small cue on the Attack line (a badge/label, e.g. "Recruit ⭢ Attack this turn"). Accessible: not colour-only (an icon/glyph + text), an `aria-label`/accessible name, no required animation (reduced-motion safe). Absent/false → nothing renders (unchanged bar).
7. `apps/arena-client/src/components/play/EconomyBar.test.ts` — assert the cue renders when the prop flag is true and is absent when false/undefined.

## Out of Scope

- **The conversion mechanic itself.** `getSpendableAttack`, `spendFightCost`, the `recruit-as-attack` handler / flag, and all WP-580 / D-24389 behaviour are **byte-unchanged**. This WP is display-only.
- **Adding a `G` field.** The flag already exists on `G.turnEconomy` (WP-580). This WP adds a UIState projection field, not a game-state field.
- **Changing the Attack/Recruit totals or the `availableAttack` computation.** The Attack readout already folds in convertible recruit (WP-580); this WP adds a cue, not a new number.
- **A prompt or an interactive choice.** The conversion stays passive (no pending choice, no button that changes gameplay); the cue is informational only.
- **The other recruit-as-attack printings** (msp1/cvwr/co2e/xmen) — still deferred at the mechanic level (D-24389); this WP's cue lights up for any card that sets the flag, so no per-card work is needed here.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** (optional `recruitSpendableAsAttack` on `UITurnEconomyState`)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** (populate the economy field, omit-when-absent)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** (active-player pass-through; `REDACTED_ECONOMY` omits it)
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** (audience test)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** (extend the drift pin)
- `apps/arena-client/src/components/play/EconomyBar.vue` — **modified** (the cue)
- `apps/arena-client/src/components/play/EconomyBar.test.ts` — **modified** (cue render / absent)
- `docs/ai/DECISIONS.md` — **modified** (land D-24390)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-581 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Cross-layer (engine projection + arena-client render); standard two-session lane.

## Contract (Locked by D-24390)

- **Project the existing flag, display-only.** The client-visible `UITurnEconomyState.recruitSpendableAsAttack` is a projection of `G.turnEconomy.recruitSpendableAsAttack` (WP-580). No new `G` field; the conversion math and spend are untouched.
- **Omit-when-absent.** The field is set (in `buildUIState`) and passed through (in the filter) only when the flag is `true`; a non-conversion turn's economy block is byte-identical to pre-WP-581. The drift pin is extended so the optional add cannot land unpinned.
- **Active-player-only.** The cue's data rides the economy block, which only the active player sees (WP-128 / D-12803). Non-active players and spectators get `REDACTED_ECONOMY` without the field. An audience test asserts this.
- **Accessible.** The cue is not colour-only (icon/glyph + text), carries an accessible name, and requires no animation (reduced-motion safe), per Vision §17.

### Determinism / persistence

No determinism or persistence surface. The projected field is derived from an existing `G.turnEconomy` flag; there is no new `G` field, no `ctx.random`, no move, no snapshot. `finalStateHash` / `PRE_WP080` are **byte-unchanged** — **verify; if either oracle moves, STOP** (a UIState projection must not touch the hash). No arena-client UIState fixture backfill is needed (the field is optional / omit-when-absent — the WP-575 precedent).

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, a `// why:` on the omit-when-absent projection + the active-player pass-through, no premature abstraction (the cue markup lives inline in `EconomyBar`). ESM, Node v22+. `apps/arena-client` typecheck (`vue-tsc`) is gated. Output discipline: full file contents for every modified file — no diffs/snippets.

---

## Acceptance Criteria

1. `UITurnEconomyState.recruitSpendableAsAttack` is populated from `G.turnEconomy.recruitSpendableAsAttack` when set, and omitted when absent/false.
2. `filterUIStateForAudience` passes the field through for the **active player** (present when set, absent when unset) and never exposes it to non-active players or spectators (`REDACTED_ECONOMY`); an audience test asserts both.
3. The `UIState` drift pin is extended as a **runtime keyset assertion on a built economy projection** (build with the flag set, `buildUIState`, assert the projected economy keyset contains `recruitSpendableAsAttack`) — not a hand-written-literal append.
4. `EconomyBar.vue` renders an accessible cue on the Attack line when `economy.recruitSpendableAsAttack` is true, and nothing when false/absent — not colour-only, with an accessible name, no required animation.
5. No `G` field is added; `getSpendableAttack` / the conversion math / all WP-580 behaviour are byte-unchanged; both hash oracles `finalStateHash` / `PRE_WP080` are byte-unchanged.
6. `pnpm -r build` 0; engine suite green (audience test + drift pin); `apps/arena-client` typecheck + tests green; `pnpm -r --no-bail test` no new failures.

## Verification Steps

```bash
# 1. Field declared + populated + filtered + pinned
grep -nE "recruitSpendableAsAttack" packages/game-engine/src/ui/uiState.types.ts packages/game-engine/src/ui/uiState.build.ts packages/game-engine/src/ui/uiState.filter.ts packages/game-engine/src/ui/uiState.types.drift.test.ts

# 2. No new G field; conversion math untouched
git diff --name-only | grep -E 'packages/game-engine/src/(economy|moves|hero)/' ; echo "expect none (display-only WP)"

# 3. Client cue is accessible (aria + not colour-only)
grep -nE "recruitSpendableAsAttack|aria-label|aria-" apps/arena-client/src/components/play/EconomyBar.vue

# 4. Build + suites + hash oracles
pnpm -r build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4
pnpm --filter @legendary-arena/arena-client typecheck 2>&1 | tail -3
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -3
pnpm -r --no-bail test 2>&1 | tail -6
# Expected: engine + arena-client green; both hash oracles byte-unchanged; no new failures

# 5. Live (post-deploy; D-24026): play.legendary-arena.com — play God of Thunder; the Economy
#    bar shows the cue for the rest of the turn and clears next turn. Record in STATUS.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] Field projected omit-when-absent; active-player-only via the filter (audience test); drift pin extended as a built-projection runtime keyset assertion
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only` spot-check)
- [ ] Cue is accessible (not colour-only, accessible name, reduced-motion safe)
- [ ] No `G` field; conversion math + WP-580 behaviour byte-unchanged; both hash oracles byte-unchanged
- [ ] Engine suite green; `apps/arena-client` typecheck + tests green; `pnpm -r` otherwise no new failures
- [ ] `docs/ai/STATUS.md` Done entry names WP-581; records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24390 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-581 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-616:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed on the deployed Economy bar (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-21)

Independent gate review verified all 8 pre-flight items by reading source — **no fabricated symbols**: `G.turnEconomy.recruitSpendableAsAttack` (`economy.types.ts:41`), `UITurnEconomyState` and its 6 fields (`uiState.types.ts:526-533`, lacks the flag), `filterUIStateForAudience` field-by-field active-player rebuild + `REDACTED_ECONOMY` (`uiState.filter.ts:42,379-393`), the drift-pin file (`uiState.types.drift.test.ts`), and `EconomyBar.vue` (`economy` prop, renders `availableAttack`) + `EconomyBar.test.ts` are all real and correctly named. Determinism claim confirmed correct: UIState is a projection of `G`, never hashed (`hashGameState.ts` hashes `LegendaryGameState` only), so no re-pin. The client imports `UITurnEconomyState` from the engine, so the optional field propagates to `vue-tsc` automatically. Allowlist complete. Preconditions A–D pass.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-21)

Boundary correct (engine projects, client renders through the engine's exported type). The EC-206 whitelist-drop failure is explicitly pre-empted (Scope #3 + EC guardrail + audience test). Determinism clean (no `G` field / no hash). A11y specified. No scope creep (Out-of-Scope fences the mechanic byte-for-byte). One RISK surfaced and **fixed in this draft**: the "extend the drift pin" step now specifies a **runtime keyset assertion on a BUILT economy projection** (the WP-575 effectTraces precedent), not a hand-written-literal append — otherwise it would reproduce the exact WP-562 silent-optional-drop this WP claims to prevent (Scope #5, AC-3, EC guardrail updated).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (2026-08-21)

§3 Assumes (A–D + WP-580 dep), §4 Context (ARCHITECTURE UIState section + D-24389/D-24390/D-12803), §5 Files (all marked/described), §13 Verification (exact `pnpm` + expected output), §14 AC (6 binary), §15.1 User-Visible (surface + Impact + D-24026 live-on-surface DoD item), §17 Vision (§10/§17/§3/§22 + no-conflict + NG-check + determinism line), §20 / §21 N/A with named justifications, §16 code-style — all PASS. Two soft-gaps: **§15 DoD scope-boundary checkbox added** in this draft; §1/§2 uses the corpus-standard `## Contract` (Determinism + Code-style/output-discipline, citing `00.6-code-style.md` + full-file/no-diffs) in place of a literal `## Non-Negotiable Constraints` heading — consistent with every shipped WP (WP-576/577/580).

---

## Vision Alignment

**Clauses touched:** §10 (play surface — the cue makes an existing mechanic discoverable), §17 (accessibility — the cue is not colour-only, carries an accessible name, and is reduced-motion safe), §3/§22 (determinism — a read-only projection of an existing flag; no scoring/replay/RNG change). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it surfaces the WP-580 conversion without altering the mechanic or determinism. **Non-Goal proximity:** none of NG-1..NG-8 — no monetization, no pay-gating, no player-interaction terminology; the cue is a free, informational play-surface affordance. **Determinism preservation:** no engine game-state, RNG, replay, or persistence change — the field is a projection of an existing `G.turnEconomy` flag; `finalStateHash` / `PRE_WP080` untouched.

## Funding Surface Gate

**N/A** — a play-surface information cue; no §20.1 funding surface, no funding copy, no funding channel. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function changes; a game-engine projection + arena-client render. `docs/ai/REFERENCE/api-endpoints.md` is unaffected. (Authority: WP-118 / D-11804.)

## Decision (reserved, lands at execution)

**D-24390 — recruit-as-attack-visible-cue.** Reserved in `NUMBER-LEDGER.md` at draft; the `DECISIONS.md` entry lands **Active** when the WP executes. Records: the existing WP-580 flag is projected onto `UITurnEconomyState` (a projection, not a new `G` field — no hash surface), omit-when-absent, active-player-only with the drift pin extended; the cue is display-only (WP-580 / D-24389 behaviour byte-identical) and accessible (non-colour-only, aria-labelled, reduced-motion); rationale is the WP-580 live-verify's "no option provided" — a passive economy change is undiscoverable even when working.
