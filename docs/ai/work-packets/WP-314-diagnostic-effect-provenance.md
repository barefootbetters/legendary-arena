# WP-314 — Diagnostic Export: Card-Effect Provenance + "Awaiting Input" Reason

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client` — diagnostics capture)
**Dependencies:** WP-228 / WP-246 (the diagnostic capture + export ✅) · WP-257 / WP-258 (`hollowEffects` channel already on the export ✅) · relates to WP-313 (once it projects `pendingVictoryPileCardPick`, this surfaces it) — no hard ordering, but lands cleanest after WP-313.
**User-Visible Surface:** none — operator/developer diagnostics only (the Download-diagnostics export).

> **Motivation.** The 2026-07-05 Ebony Blade freeze (match `D0_OMZnnUWQ`) was **invisible in the exported diagnostic**: the file showed a valid board with the card played, but nothing indicated the turn was *blocked awaiting a victory-pile pick*. Root-causing it required tracing the engine. The export already carries `hollowEffects` (parse-unrecognized markers), but it does **not** answer the two questions a "froze after I played card X" report needs: **(1) is the turn blocked awaiting player input, and on what?** and **(2) did the card I just played actually fire — what does its text say vs. what happened?**

---

## Session Context

The arena-client freeze diagnostic (WP-228/246) serializes a `uiStateSnapshot` (the UIState projection: board + `log` + `notableEvents` + `hollowEffects`) plus match metadata. `hollowEffects` (WP-258) already surfaces *unrecognized* markers. But the most common real freeze — an interactive **block-all pending choice** with no client UX (the Ebony Blade class of bug) — leaves no legible signal: the pending choice is either chooser-redacted deep in UIState or (pre-WP-313) not projected at all, and the log only says "played X". This packet adds a compact, top-level **effect-provenance** section so a card-play freeze is self-diagnosing from the file alone.

---

## Goal

After this session, the diagnostic export carries a top-level **`effectProvenance`** block, derived client-side from the UIState the client already holds (+ the registry for card text):

- **`awaitingPlayerInput`** — a small object naming what (if anything) the turn is blocked on: the pending-choice kind (`victoryPileCardPick` / `optionalKoReward` / `drawOrEmpowered` / `koHeroChoice`) and the chooser, derived from the projected `pending*` UIState fields. `null` when nothing is pending. This makes a block-all freeze name its own cause.
- **`recentlyPlayedCards`** — for the last **N = 5** "Player X played …" entries in the log, each card's `extId`, its printed **ability text** (from the registry), and an **outcome** classification derived from the signals already present: `resolved` (default), `hollow` (its marker is in `hollowEffects`), `awaitingChoice` (it parked the currently-pending choice), or `conditionNotMet` (the log's "ability did not activate" line for that play). So an operator can read the card's text next to what actually happened.

All of it is derived from data the client already has (UIState + `hollowEffects` + `log` + the registry card lookup the HUD already uses); **no engine change, no new server surface, no `G` read.**

---

## User-Visible Impact

None on the game surface. For operators, a "froze after playing card X" diagnostic now shows, at the top: `awaitingPlayerInput: { kind: 'victoryPileCardPick', playerID: '0' }` and `recentlyPlayedCards[…].outcome: 'awaitingChoice'` next to the card's printed text — turning a code-tracing session into a glance.

---

## Assumes

- WP-228/246 export path exists: `apps/arena-client/src/diagnostics/diagnostics.ts` builds the export payload from a passed `uiStateSnapshot` + context; the HUD resolves card display/text via the registry client already in use.
- The UIState projection carries the pending-choice fields (`pendingOptionalKoReward`, `pendingDrawOrEmpowered`, `pendingKoHeroChoice`, and — after WP-313 — `pendingVictoryPileCardPick`) and `log`. Fields absent when not applicable are handled as "none".
- `apps/arena-client` `test` + `typecheck` (vue-tsc) green on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/diagnostics/diagnostics.ts` — the export payload builder; `effectProvenance` is added here (or a small pure sibling `effectProvenance.ts` it calls).
- `apps/arena-client/src/components/play/HollowEffectsPanel.vue` — how `hollowEffects` is read from the snapshot (the outcome=`hollow` cross-reference).
- The UIState `pending*` field shapes (`packages/game-engine/src/ui/uiState.types.ts`, type-only import) — to read the pending kind + chooser.
- The registry card-text lookup the HUD already uses (for `recentlyPlayedCards[].abilityText`) — reuse it; do not add a new registry path.
- `docs/ai/work-packets/WP-258-*` — the precedent for adding a diagnostics channel to the export.

---

## Non-Negotiable Constraints

- **Client-only + read-only.** Derived entirely from the UIState the client holds + the registry; no engine/`G`/server change, no new npm dependency.
- **Pure + deterministic derivation.** `effectProvenance` is a pure function of `(uiStateSnapshot, registryLookup)`; no wall-clock, no side effects. Small, JSDoc'd, `for...of` (no `.reduce()`).
- **Bounded.** `recentlyPlayedCards` is capped at **N = 5** (a locked constant with a `// why:`), so the export cannot bloat on a long log.
- **Fail-soft.** A missing registry entry / unparseable log line degrades to `abilityText: null` / `outcome: 'resolved'` — the diagnostic never throws or blocks the export (the WP-246 export must stay robust).
- **No redaction regression.** `effectProvenance` reads only what is already in the (already-audience-filtered) UIState snapshot the client exports; it introduces no new private data into the file.

---

## Scope (In)

### A) Effect-provenance derivation
- **`apps/arena-client/src/diagnostics/effectProvenance.ts`** — new pure module: `buildEffectProvenance(snapshot, resolveCardText) → { awaitingPlayerInput, recentlyPlayedCards }`.
  - `awaitingPlayerInput`: inspect the projected `pending*` fields → `{ kind, playerID } | null`.
  - `recentlyPlayedCards`: scan the last N=5 "played …" log lines → `{ extId, abilityText, outcome }` with the outcome cross-referenced against `hollowEffects`, the pending kind, and the "did not activate" log lines.
- **`apps/arena-client/src/diagnostics/diagnostics.ts`** — call it and attach `effectProvenance` to the export payload (+ the `DiagnosticContext` type field).

### B) Tests
- **`apps/arena-client/src/diagnostics/effectProvenance.test.ts`** — new: `awaitingPlayerInput` for each pending kind + null; the four `outcome` classifications; the N=5 cap; fail-soft on a missing card entry.
- **`diagnostics.test.ts`** (if present) — the payload includes `effectProvenance`.

---

## Out of Scope

- **No engine change.** Outcome is *inferred* client-side from existing signals; this WP does NOT add an engine-side per-move effect-result channel (a richer future option; noted below).
- **No new UI surface** — this is export-payload only (no on-screen panel; `HollowEffectsPanel` already covers the on-screen hollow view).
- **No change to the freeze fix** — WP-313 fixes the Ebony Blade freeze; this only makes such freezes legible in the export.
- **No new npm dependency.**

---

## Files Expected to Change

- `apps/arena-client/src/diagnostics/effectProvenance.ts` — **new** — derivation.
- `apps/arena-client/src/diagnostics/effectProvenance.test.ts` — **new** — tests.
- `apps/arena-client/src/diagnostics/diagnostics.ts` — **modified** — attach `effectProvenance` + the context type.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24100), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] The export payload includes `effectProvenance.awaitingPlayerInput` = `{ kind, playerID }` when a `pending*` choice is projected, else `null`.
- [ ] `effectProvenance.recentlyPlayedCards` lists the last ≤5 played cards with `extId`, `abilityText` (registry), and `outcome` ∈ `{ resolved, hollow, awaitingChoice, conditionNotMet }`.
- [ ] A card whose marker is in `hollowEffects` classifies `hollow`; a card that parked the pending choice classifies `awaitingChoice`; a "did not activate" log line classifies `conditionNotMet`.
- [ ] N=5 cap enforced; missing registry entry degrades to `abilityText: null` without throwing.
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` pass; `pnpm -r build` 0.
- [ ] No engine/server diff (`git diff --name-only` → arena-client + governance only).
- [ ] `docs/ai/DECISIONS.md` D-24100 landed.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck ; pnpm --filter @legendary-arena/arena-client test
git diff --name-only | Select-String "packages/|apps/server"   # Expected: no output (client-only)
Select-String -Path "apps\arena-client\src\diagnostics\effectProvenance.ts" -Pattern "awaitingPlayerInput|recentlyPlayedCards"
git diff --name-only
```

---

## Definition of Done

- [ ] **User-Visible Surface: none — diagnostics only.** No live-on-surface D-24026 gate; the DoD is: the next captured diagnostic (e.g. a re-triggered Ebony Blade freeze pre-WP-313, or any pending-choice state) shows `awaitingPlayerInput` + the played-card outcomes. (Operator spot-check optional; STATUS.md notes the diagnostics-only surface.)
- [ ] All acceptance criteria pass; arena-client suite + `typecheck` + `pnpm -r build` green.
- [ ] STATUS.md / DECISIONS.md (D-24100) / WORK_INDEX.md / EC_INDEX.md updated.

---

## Scope Note for Operator (resolve at gating)

Two depth options; this WP is drafted at the **lighter, client-inference** tier:

- **(A, drafted) Client-side inference** — derive `outcome` from the signals already in UIState (`hollowEffects` + pending fields + the log's "did not activate" lines). Zero engine change, ships fast, ~90% of the debugging value. Its limit: `outcome: 'resolved'` is a *default* (absence of a negative signal), not a positive per-move confirmation.
- **(B, deferred) Engine effect-result channel** — the engine emits a positive per-play effect-result record (fired / parked / hollow / condition-not-met) into `G.diagnostics`, projected + exported. Authoritative but a larger engine+projection+client change. Recommend deferring to a follow-up unless the inference tier proves too coarse in practice.

Default: ship (A) now; open (B) only if needed.

---

## Vision Alignment

> §17 triggered: none of the gameplay/monetization surfaces — this is developer diagnostics. (§14 Explicit Decisions / observability.)

- **Vision clauses touched:** §3 (Trust & Fairness — better observability of what the engine did; no behavior change), §14 (explicit, inspectable decisions). No monetization/scoring/identity/multiplayer-sync clause.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` Read-only diagnostics derivation; no gameplay/determinism impact (Vision §22 untouched — no `G` change).
- **Non-Goal proximity:** none of NG-1..7 crossed.
- **Determinism preservation:** pure client-side derivation over existing UIState; no `G`/move/RNG touch.

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. Verdict: **PASS.**

- **§1 Structure / §2 Constraints / §3 Assumes / §4 Context / §5 Files** — PASS. Sections present; ≥2 out-of-scope (no engine change; no UI surface); client-only; WP-258/246 precedents + the exact files cited.
- **§6 Naming** — PASS. `effectProvenance`, `awaitingPlayerInput`, `recentlyPlayedCards`, `buildEffectProvenance` — full words; no 00.2 field.
- **§7 Dependency / §8 Boundaries** — PASS. No new dep; arena-client-only; read-only over UIState + registry; no `G`/server/engine edit.
- **§9 Windows / §13 Verification** — PASS. `pwsh` + `Select-String` + `pnpm --filter`.
- **§10 Env / §11 Auth / §20 Funding / §21 API Catalog** — N/A.
- **§12 Tests** — PASS. Pure-module tests: each pending kind, each outcome, the N=5 cap, fail-soft.
- **§14 AC / §15 DoD** — PASS. Binary; §15.1: `User-Visible Surface = none — diagnostics only`, so no live-on-surface gate (declared, per D-24026 N/A-for-infra).
- **§16 Code style** — PASS. Small pure module, JSDoc, `// why:` on the N=5 cap + fail-soft, `for...of`.
- **§17 Vision** — PASS. Block present; §3/§14/§22; no-conflict + determinism line.
- **§18 Prose-vs-grep / §19 Bridge-vs-HEAD** — PASS / N/A. Greps target `packages/|apps/server` (no-change) + the new symbols.
