# WP-436 — Retire the `effectProvenance` Outcome Heuristic (Read the Authoritative `LogEntry.outcome`)

> **WP-B.3c** — the final slice of the structured log-outcome arc (D-24253 §Fork F).
> B.3a authored `LogEntry.outcome`; B.3b made it visible; B.3c makes the freeze
> diagnostic **read** it instead of string-guessing.

## Goal

The freeze-diagnostic's `effectProvenance.recentlyPlayedCards[].outcome` currently
**guesses** whether a played card's ability fired — by string-matching a "… ability
did not activate" log line and defaulting to `resolved` in the absence of a negative
signal (a guess, "NOT a positive engine confirmation," per its own docstring). Now
that the engine authors an authoritative `LogEntry.outcome` on every log line (B.3a),
this WP replaces that guess with an **authoritative read**: a played card's outcome
derives from the engine-authored outcome of its effect log lines. `awaitingPlayerInput`
(the pending-freeze read) and the structured `hollowEffects` read are **kept** — they
were never string-matching. This retires the last prose-guessing heuristic in the
diagnostic while preserving its output contract.

## Assumes

- **WP-434 / D-24253 (B.3a) — merged.** `UIState.log` is `LogEntry[]` (`{ text,
  outcome }`); `LogOutcome` = `neutral | applied | partial | blocked`, exported from
  `@legendary-arena/game-engine`. B.3b (WP-435) merged — the outcome is proven in a
  live match (the Magneto game: 296 `neutral` + 27 `blocked` + 11 `applied`), which
  D-24253 §Fork F required before this retirement.
- `effectProvenance.ts` (WP-314 / D-24100) is a **pure, boundary-clean** client
  diagnostic that reads the UIState snapshot structurally from `unknown`; it imports
  nothing from the engine at runtime (may `import type`).
- Baseline `origin/main` @ `6018ac11`.

## Context (Read First)

D-24253 §Fork F scoped B.3c precisely: `effectProvenance` carries **two** independent
fields — `awaitingPlayerInput` (reads `pending*`; **survives**) and
`recentlyPlayedCards[].outcome` (the **string-matching heuristic**; **this is what
B.3c retires**, "replaced by reading the authoritative `outcome` off the projected
`LogEntry` records"). Sequenced last, after the channel was proven in a live match
(now true).

**What is actually string-matching today** (the retirement target): `classifyOutcome`
scans a card's following log lines for `DID_NOT_ACTIVATE_LINE` (`/ ability did not
activate/`) → `conditionNotMet`, else defaults to `resolved`. That "did it fire?"
determination is the guess. **What is NOT string-matching** (kept): the
`hollowEffects` structured read (`collectHollowCardIds`, WP-257 records carry
`cardId`) → `hollow`; `readAwaitingPlayerInput` (`pending*` fields) → `awaitingChoice`
/ `awaitingPlayerInput`.

**Taxonomy decision (recommended — this is the one real fork; flagged for review).**
The diagnostic's `PlayedCardOutcome` (`resolved` / `hollow` / `awaitingChoice` /
`conditionNotMet`) does **not** map 1:1 to `LogOutcome`. This WP **keeps the existing
4-value `PlayedCardOutcome` contract** and makes only the *determination*
authoritative — a card's `conditionNotMet`/`resolved` split now comes from the
authoritative `LogEntry.outcome` of its effect lines (`blocked` → the effect did
nothing → `conditionNotMet`; `applied`/`partial` → `resolved`) instead of the "did not
activate" string. `hollow` and `awaitingChoice` are unchanged. **Rationale:** it
honours §Fork F ("read the authoritative outcome"), preserves the diagnostic's output
contract so no downstream consumer breaks, and deletes the specific string-heuristic.
**Alternatives, deliberately not chosen** (surface for review): (2) expose the raw
`LogOutcome` per card — a contract change dropping the hollow/conditionNotMet
distinction; (3) delete `recentlyPlayedCards[].outcome` entirely (now visible in the
coloured log) — §Fork F says *replace*, not delete. If (2)/(3) is preferred, it is a
small change to this WP.

**Out of this WP's reach (noted, not done):** B.3a made `LogEntry` `{ text, outcome }`
only — it does **not** carry a structured per-line card ext-id — so the played-card
*identification* still parses the "played X ({ext-id})" line (`PLAYED_LINE` /
`PLAYED_LABEL_EXTID`, the regex that broke in WP-328/417). Fully removing THAT parse
would require extending the engine `LogEntry` with a structured `card?` field — a
cross-layer contract change beyond §Fork F's "retire the outcome heuristic." It stays
a documented future option, not part of B.3c.

**Honest scope of the "regression-proof" claim.** D-24253 §14's survival-lens promise
that B.3 means "the next log re-wording *cannot* break the freeze diagnostic" is only
**partially** delivered by B.3c: the outcome *determination* is now authoritative, but
the played-card *identification* still parses "played X ({ext-id})" prose (and step 2
still matches the condition-fail line shape). A re-wording of those lines can still
break identification. The §14 promise is fully realized only once a structured
`LogEntry.card` field lands (the future option above); this WP does not over-claim it.

## Scope (In)

- `apps/arena-client/src/diagnostics/effectProvenance.ts`:
  - Read the projected log as **records** (`{ text, outcome }`), not a flattened
    `string[]`, so the outcome is available alongside the text (defensively, since the
    snapshot is `unknown`).
  - `classifyOutcome` reads the **authoritative** `LogEntry.outcome` of the card's
    following effect lines for the fired/didn't-fire determination, **hollow-first**
    (PS-1): (1) ext-id in `hollowCardIds` (structured, kept) → `hollow`; (2) else a
    line in **the card's own play-window** (`[lineIndex+1, nextPlayedLineIndex)`) whose
    text names the card in the condition-fail **shape** with `outcome === 'blocked'` →
    `conditionNotMet`; (3) else most-recent + pending → `awaitingChoice`; (4) else
    `resolved`. Hollow MUST precede the blocked check (a hollow effect also logs a
    `blocked` "Unhandled effect observed" line). **RS-2 (locked):** bound the scan to the
    card's own play-window and match its own condition-fail line shape, NOT any `blocked`
    line that merely `includes(extId)` — the reveal "no branch matched" line is also
    `blocked` and names the *revealed* card, so a bare substring match over an unbounded
    tail could false-`conditionNotMet` on an ext-id collision. **Delete**
    `DID_NOT_ACTIVATE_LINE`.
  - Keep `readAwaitingPlayerInput`, `collectHollowCardIds`, `buildSnapshotAbilityText…`,
    and the `PLAYED_LINE` / `PLAYED_LABEL_EXTID` **identification** parse unchanged.
  - Update the module docstrings — the file header, the `recentlyPlayedCards` field doc,
    AND the `classifyOutcome` JSDoc ("the absence of a negative signal, NOT a positive
    engine confirmation") — so none still claim the `outcome` is an inference / read from
    "did not activate" lines; it is now an authoritative read (D-24100 "guess" caveat removed).
- `apps/arena-client/src/diagnostics/effectProvenance.test.ts`: the fixtures already
  seed records (`{ text, outcome }` post-B.3a). Re-point the outcome cases to assert
  the authoritative-read behaviour (a `blocked` following line → `conditionNotMet`; an
  `applied`/`partial` line → `resolved`; hollow record → `hollow`; pending →
  `awaitingChoice`), and add a case proving a `resolved` now comes from a positive
  `applied` outcome, not merely the absence of a "did not activate" string.

## Out of Scope

- Any engine / `G` / `UIState` / `LogEntry` shape change (no structured per-line
  `card` field — see §Context).
- `awaitingPlayerInput`, the `hollowEffects` read, the played-card identification
  parse, `abilityText` resolution — all unchanged.
- The `PlayedCardOutcome` taxonomy values (kept; recommended option 1).
- Server, registry, persistence, determinism, the game log rendering (B.3b).

## Files Expected to Change

- `apps/arena-client/src/diagnostics/effectProvenance.ts`
- `apps/arena-client/src/diagnostics/effectProvenance.test.ts`
- **governance:** `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `STATUS.md`, `docs/ai/DECISIONS.md` (annotate D-24253 with the B.3c landing — the
  arc is complete).

Single layer (arena-client). Any file outside is STOP-and-escalate.

## Contract

- `EffectProvenance` / `RecentlyPlayedCard` / `PlayedCardOutcome` shapes **unchanged**
  (output contract preserved).
- `recentlyPlayedCards[].outcome` is now an **authoritative read** of the engine's
  `LogEntry.outcome` (blocked → conditionNotMet; applied/partial → resolved), with
  `hollow` (structured) and `awaitingChoice` (pending) unchanged.
- The module stays pure + boundary-clean (structural `unknown` reads; `import type`
  only from the engine).

## Acceptance Criteria

1. `DID_NOT_ACTIVATE_LINE` is deleted; no `outcome` determination string-matches log
   prose. A hollow card → `hollow` (checked first); else a `blocked` following line for
   the card → `conditionNotMet`; else `resolved` is the default (the 4-value taxonomy
   has no "unknown", so `resolved` stays the catch-all — but it is now reached only
   after the authoritative `blocked`/`hollow`/pending checks, not by string-guessing).
2. `hollow` (from `hollowEffects`) and `awaitingChoice` (from `pending*`) are
   unchanged; `awaitingPlayerInput` is byte-unchanged.
3. The `PlayedCardOutcome` / `EffectProvenance` output shapes are unchanged.
4. The module stays pure, fail-soft (null/malformed snapshot → empty provenance; never
   throws), and boundary-clean (no engine runtime import).
5. arena-client `test` + `typecheck` 0; `pnpm -r build` 0. No engine/other-package
   change.

## Verification Steps

1. `pnpm -r build && pnpm --filter arena-client test` — green; `typecheck` 0.
2. Feed the Magneto diagnostic snapshot (`legendary-arena-diagnostics-magneto.json`,
   `uiStateSnapshot`) through `buildEffectProvenance` in a test/REPL and confirm the
   `recentlyPlayedCards` outcomes match the authoritative `LogEntry.outcome` of each
   card's lines (the `blocked` Team Player / reveal lines → `conditionNotMet`).
3. `git diff --name-only` = the allowlist.

## Definition of Done

- All AC met; arena-client suite + typecheck + build green.
- Governance closed: WORK_INDEX `[x]`, EC_INDEX Done, mindmap B.3c node `✅` +
  `roadmap:counts:write`, STATUS entry, D-24253 annotated **arc complete (B.3a/b/c)**.
- `User-Visible Surface = none` (a diagnostic-export internal; the export shape is
  unchanged, only the outcome's provenance) — **D-24026 N/A**; state the reason.

## Lint Gate Self-Review (00.3 — 21 sections)

1. **Scope closed** — PASS (arena-client diagnostic only; allowlist boundary).
2. **Layer boundary** — PASS (App-layer client diagnostic; `import type` only from
   engine; no engine/server/registry edit).
3. **Determinism** — N/A (client read; no `G`/RNG/hash).
4. **Persistence** — N/A.
5. **Contract files** — N/A (no `.types/.validate/.gating`; the diagnostic output
   shapes are unchanged).
6. **Naming** — PASS.
7. **Canonical arrays** — N/A (consumes `LogOutcome`; introduces none).
8. **Moves never throw** — N/A.
9. **Phase/turn `// why:`** — N/A.
10. **`.reduce()` ban** — PASS.
11. **Error messages** — N/A (fail-soft, no new error paths).
12. **Comments explain why** — PASS (the authoritative-read rationale + the retained
    structured reads).
13. **Test extension** — PASS (`.test.ts`).
14. **`makeMockCtx`** — N/A.
15. **Field-name fidelity** — PASS (`outcome`/`LogEntry` per the engine).
16. **Vision alignment** — PASS (§14 observability — a truer diagnostic).
17. **No invented mechanics** — PASS (reads existing data).
18. **DECISIONS reference** — PASS (implements D-24253 §Fork F; annotates it complete;
    no new D — the retirement was already ruled).
19. **API catalog (D-11804)** — N/A.
20. **Mindmap node** — PASS (B.3c node added; counts written).
21. **User-visible surface / D-24026** — PASS (declared N/A with reason — internal
    diagnostic, output shape unchanged).

All 21 resolved (PASS or justified N/A).

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE** (independent subagent, 2026-07-26), after fixing **PS-1**: the
`classifyOutcome` mapping ran the `blocked`-line check before the hollow read, but a
hollow effect also logs a `blocked` "Unhandled effect observed" line — so blocked-first
would misclassify every hollow as `conditionNotMet`. Reordered **hollow-first**
(verified safe: the condition-fail branch `continue`s without `recordHollowEffect`, so
hollow XOR condition-fail holds). Verified B.3a/b on `main`, the "did not activate" line
is authored `blocked`, `LogEntry` has no structured `card` field (so the identification
parse stays), and the module is boundary-clean.

## Copilot Check Verdict (01.7)

**PASS** (independent subagent, 2026-07-26), after **RISK/HOLD** on the `blocked`-match
being strictly wider than the retired string (the reveal "no branch matched" line is
also `blocked` and names the *revealed* card). Locked the RS-2 mitigation: bound the
scan to the card's own play-window `[lineIndex+1, nextPlayedLineIndex)` and match its own
condition-fail line **shape**, not any `blocked` line that `includes(extId)`. Also made
the `neutral`→`blocked` fixture flip mandatory (Finding 4) and added the honest §14
scope caveat (Finding 7). PS-1 hollow-first + the RS-3 hollow regression test confirmed
sound.
