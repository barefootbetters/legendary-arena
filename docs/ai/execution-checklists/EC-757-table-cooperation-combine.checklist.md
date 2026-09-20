# EC-757 — Synergy Realization: Table Cooperation one-seat-sweep combine

**WP:** WP-720 · **Layer:** Server only · **Lane:** Standard two-session · **Status:** Pending

Governs WP-720: group the Table Cooperation role attributions by seat so one seat that
sweeps all three roles is named once (not 3×). A display refinement to WP-717/D-24540's
`computeTableCooperation`. Server-only; no engine/client/hash surface.

## Before Starting

- [ ] Baseline `origin/main` @ `0944c720`; server suite green pre-change.
- [ ] Confirm on `main`: `computeTableCooperation` (`apps/server/src/coach/tableCooperation.logic.ts`) emits the outcome line + three independent role lines (combat/synergy/rescue via `pickTopSeat`, zero-metric omitted) + a combined-total line; WP-718 renders each as one `<li>` verbatim (so grouping needs no client change).

## Locked Values

- Grouping: compute the three winners (unchanged `pickTopSeat` calls — combat = max `villains+henchmen+tactics`; synergy = max `conditionalClausesAssembled`, tie-break `conditionalClausesRealizedValue`; rescue = max `bystandersRescued`). Build one achievement fragment per non-null winner. Group fragments by winning seat **object identity** — the `pickTopSeat`-returned `CoachPlayerLine` reference (`===`), NOT the display `label` (labels are unique today, but keying on identity is robust against any future label change and is zero extra cost since `pickTopSeat` already returns the object) — in **first-appearance order** (combat → synergy → rescue). Emit ONE line per distinct winning seat. Add a `// why:` noting the key is seat identity, not the display label.
- Single-role line (verbatim, unchanged): `{label} carried the combat — {N} enemies defeated.` / `{label} assembled the most synergy — {N} conditional clauses landed.` / `{label} carried the rescue — {N} Bystanders saved.`
- Multi-role line: `{label} anchored the table — {frag1}, {frag2}, and {frag3}.` (Oxford-and join; 2 frags → `{frag1} and {frag2}`). Fragments: `{N} enemies defeated`, `{N} conditional clauses landed`, `{N} Bystanders saved` (reuse the existing `withCount` singular/plural).
- Unchanged: outcome line, zero-metric omission, solo/single-seat + all-zero degradation, the combined-total line, `pickTopSeat`.
- Copy-lint banned sets (word-boundary, lowercased): `whiff`/`failed`/`error`/`missed`/`wasted`; `opponent`/`beat`/`versus`/`vs`/`winner`/`loser`. ("anchored", "carried", "defeated" are clean.)

## Guardrails

- **Grouped by seat; no seat named twice.** Deterministic (first-appearance over combat→synergy→rescue).
- **Achievements preserved exactly** — same winners, same counts as WP-717; only line grouping/phrasing changes.
- **Both vocabularies preserved** (word-boundary lint) — celebration AND cooperative.
- **Server-only, display-only, off-ranking** (NG-1); no engine/`G`/hash/replay; not model-authored; no client change.
- **No `.reduce()`** in the grouping — `for...of` + a Map/array keyed by seat **identity** (the `pickTopSeat`-returned `CoachPlayerLine` reference), not the display label.
- **Intended behavior change:** the existing "names the standout co-op roles" test is UPDATED to the grouped shape (product output intentionally changed — reward-integrity: the commit says so). Never weaken a test to pass; assert the new grouped output.
- App standing rules; `.test.ts` on `node:test`.

## Required Comments (`// why:`)

- On the grouping order (why combat→synergy→rescue first-appearance — deterministic, matches the compute order).
- On the multi-role lead phrasing (why a general "anchored the table" lead instead of repeating a role verb).

## Files to Produce

Mirror WP-720 §Files (2 files, server only): `tableCooperation.logic.ts` (group role lines by seat), `tableCooperation.logic.test.ts` (grouped-shape expectations + sweep / 2+1 / all-distinct). `coach.logic.ts`, `coach.types.ts`, the client, and `api-endpoints.md` are NOT touched (field shape unchanged).

## After Completing

- [ ] Server suite green (record delta); `pnpm -r build` 0.
- [ ] Sweep → 1 line; 2+1 → 2 lines; all-distinct → 3 lines (WP-717 behavior preserved); zero-metric omission preserved; both copy-lint vocabularies green. Add a "no seat label appears in more than one role line" assertion (the no-seat-named-twice guardrail, beyond the line-count checks).
- [ ] `git diff --name-only` = the 2 server files + governance (no engine/client/`packages`).
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS.
- [ ] Two-commit topology (`EC-757:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (post-deploy): the real Red Skull match's Table Cooperation block shows one combined line for the sweeping seat.

## Common Failure Smells

- Emitting a seat twice (grouping not applied) — group by seat identity (the `pickTopSeat` reference), one line per seat.
- Weakening the existing role-line test instead of updating it to the grouped shape (reward-integrity FAIL).
- A multi-role lead that repeats a role verb ("carried the combat and carried the rescue") — use the single general lead.
- `.reduce()` in the grouping (forbidden — `for...of`).
- Touching the client / `coach.logic.ts` / `api-endpoints.md` (field shape unchanged — this is composition-only, server-only).
