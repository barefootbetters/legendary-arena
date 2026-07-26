# EC-471 — Retire the `effectProvenance` Outcome Heuristic (Read the Authoritative `LogEntry.outcome`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-436-effectprovenance-outcome-retire.md
**Layer:** arena-client only (`diagnostics/effectProvenance.{ts,test.ts}` + governance). No engine/server/registry change.
**Lane:** Standard, two-session. **WP-B.3c** — the final slice of the D-24253 log-outcome arc. Retires the string-guessing outcome heuristic; `awaitingPlayerInput` + `hollowEffects` reads stay.

## Before Starting
- [ ] Worktree off `main`, clean, synced; baseline `origin/main` @ `6018ac11` recorded.
- [ ] Confirm B.3a + B.3b on `main`: `UIState.log` is `LogEntry[]` (`{ text, outcome }`); the outcome is proven live (Magneto game). Re-read D-24253 **§Fork F** (the retirement ruling) and WP-436 §Context (the taxonomy decision — recommended option 1: keep the 4-value contract, make the determination authoritative).
- [ ] Confirm `effectProvenance.ts` currently flattens the log to `logLines: string[]` and `classifyOutcome` uses `DID_NOT_ACTIVATE_LINE` — that string-match is the retirement target.
- [ ] Target file set = WP-436 `## Files Expected to Change`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- **Retire:** delete `const DID_NOT_ACTIVATE_LINE = / ability did not activate/;` and the string-match branch in `classifyOutcome`.
- **Read records, not flattened text:** project the log as `{ text: string; outcome: LogOutcome }[]` (defensive structural read from `unknown`), so each following line's `.outcome` is available for the determination.
- **Authoritative outcome mapping** (`classifyOutcome`, priority order — HOLLOW FIRST, PS-1):
  1. the ext-id is in `hollowCardIds` (structured `hollowEffects` read, **kept**) → `hollow`. **This MUST run before the blocked-line check** — a hollow effect ALSO logs a `blocked` "Unhandled effect observed: card …" line containing the ext-id (`hollowEffect.record.ts`), so a blocked-first order would misclassify every hollow card as `conditionNotMet`. Safe because the condition-fail branch `continue`s WITHOUT `recordHollowEffect` (a card is hollow XOR condition-failed, never both), so hollow-first loses nothing.
  2. else a following line in **the card's own play-window** whose `.text` names the card with **`.outcome === 'blocked'`** → `conditionNotMet` (authoritative "the effect did nothing" — replaces the "did not activate" string). **RS-2 (LOCKED, not advisory — the `blocked`-match is strictly wider than the retired string):** (a) bound the scanned lines to `[lineIndex+1, nextPlayedLineIndex)` — a card owns ONLY the lines up to the next "played …" line, so it cannot absorb a later card's `blocked` line; (b) match the card's own condition-fail line **shape** (the `…'s {ref} ability did not activate…` / possessive-`'s`-then-ext-id form), NOT any `blocked` line that merely `includes(extId)` as a substring. Rationale: the reveal "…revealed {ref} … no branch matched" line is ALSO `blocked` and names the **revealed** (deck-top) card, so a bare `includes(extId)` + unbounded slice would false-`conditionNotMet` on an ext-id substring collision (played `slug#1` ⊂ revealed `slug#10`).
  3. else `isMostRecentPlay && awaitingPlayerInput !== null` (**kept**) → `awaitingChoice`;
  4. else → `resolved` (the **default** when no `hollow`/`blocked`/pending signal exists; note the 4-value taxonomy has no "unknown", so `resolved` stays the catch-all — RS-1).
- **Unchanged:** `readAwaitingPlayerInput`, `collectHollowCardIds`, `buildSnapshotAbilityTextResolver`, `PLAYED_LINE`, `PLAYED_LABEL_EXTID`, `extractPlayedExtId`, `RECENTLY_PLAYED_CARDS_CAP`, and every exported type shape (`PlayedCardOutcome` / `RecentlyPlayedCard` / `EffectProvenance`).
- **Signature note (realize the bound in code, not just tests):** `classifyOutcome` today takes a pre-sliced `followingLines: string[]` that already runs to end-of-log (`:207/:288`). To deliver the play-window bound, the CALLER must pass window-bounded **records** (`{text,outcome}` up to `nextPlayedLineIndex`), or `classifyOutcome` must receive the next-played index and slice itself — re-pointing the existing end-of-log slice does NOT satisfy the locked RS-2 rule.

## Guardrails
- **Output contract is frozen** — `PlayedCardOutcome` stays the 4-value union; do NOT expose raw `LogOutcome` or delete the field (those are the rejected alternatives 2/3 — see WP §Context; if the operator wants one, it is a WP change, not an execution call).
- **Retire only the outcome heuristic** — do NOT touch `awaitingPlayerInput`, the `hollowEffects` read, or the played-card identification parse (`PLAYED_LINE`/ext-id). B.3c does not remove the identification parse (that needs a structured `LogEntry.card` field — out of scope).
- **Pure + boundary-clean** — structural `unknown` reads; `import type` only from `@legendary-arena/game-engine` (a `LogOutcome` type import is fine; no runtime engine import). Fail-soft: null/malformed snapshot → empty provenance; never throws. No `.reduce()`.
- **No engine / UIState / other-package change** — this is a client read of data B.3a already authored.

## Required `// why:` Comments
- The record-projection read: why the log is read as `{ text, outcome }` records now (the outcome is available on every line — B.3a).
- `classifyOutcome`: why `conditionNotMet`/`resolved` now come from the authoritative `.outcome` (`blocked` vs `applied`/`partial`) rather than the "did not activate" string — the D-24100 guess is retired; the truth is authored at push time.
- Why `hollow` (structured `hollowEffects`) and `awaitingChoice` (pending) are kept as-is (they were never string-matching).
- The file docstring update: `outcome` is an authoritative read, no longer an inference.

## Files to Produce
- `diagnostics/effectProvenance.ts` [delete `DID_NOT_ACTIVATE_LINE`; record-projection read; authoritative `classifyOutcome`; docstring update].
- `diagnostics/effectProvenance.test.ts` [outcome cases assert the authoritative read: a `blocked` following line → `conditionNotMet`; pending → `awaitingChoice`; `resolved` as the default. **RS-3 (critical): the `hollow` case MUST seed the real engine-authored `blocked` "Unhandled effect observed: card \"…\" …" line (containing the ext-id) alongside the `hollowEffects` record, and still assert `outcome === 'hollow'`** — this is the exact PS-1 regression (hollow's own blocked line must not flip it to `conditionNotMet`). The current hollow test (`:153-161`) omits that line and would false-green. **Finding 4 (mandatory): the existing `conditionNotMet` fixtures seed the "did not activate" line with `outcome: 'neutral'` (`:168`, `:204`) — the engine actually authors `'blocked'` there, so under the new outcome-keyed classifier they MUST flip to `outcome: 'blocked'` or the tests assert against stale data (a neutral line now → `resolved`).** Add a `resolved`-default case (no blocked/hollow/pending) too.].
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `STATUS.md`, `docs/ai/DECISIONS.md` (annotate D-24253 — **arc complete, B.3a/b/c**).

## After Completing
- [ ] `pnpm --filter arena-client test` 0 fail + `typecheck` 0; `pnpm -r build` 0; `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24253 arc-complete note) / WORK_INDEX (`[x]`) / EC_INDEX (Done); mindmap B.3c node `📝 → ✅` + `roadmap:counts:write`.
- [ ] `User-Visible Surface = none` (diagnostic-export internal; export shape unchanged) → **D-24026 N/A** — state the reason, do not claim a visible change.

## Common Failure Smells
- Leaving `DID_NOT_ACTIVATE_LINE` in place (or re-deriving it) — the outcome must be read, not string-matched.
- Changing the `PlayedCardOutcome` values or deleting the field (rejected alternatives — WP §Context).
- Dropping the `hollowEffects` read or the `awaitingPlayerInput` read (both stay — they were never the heuristic).
- Importing engine runtime code (only `import type` is allowed — keep the module boundary-clean).
- Removing the played-card identification parse (out of scope — needs a structured `LogEntry.card`).
- A `resolved` that still means "no negative signal" rather than "an `applied`/`partial` line confirmed it" for cards that DO have an effect line.
