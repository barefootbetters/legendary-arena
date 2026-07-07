# EC-353 — Game Log Name Enrichment: Card Plays + Mastermind Tactics (Execution Checklist)

**Source:** docs/ai/work-packets/WP-323-game-log-name-enrichment.md
**Layer:** game-engine only (a new pure `log/logDisplay.ts` + 3 move sites + tests + fixture re-pin; no client/server/registry change)
**Lane:** Standard two-session (message-oracle change + >4 files). Build the reusable helpers + the two cited log lines; WP-324 sweeps the rest.

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `d00f3613` recorded.
- [ ] **Scaffold first:** prototype the three line changes, run `pnpm --filter @legendary-arena/game-engine test`, and record which move tests + which replay fixture(s) break on the message text. Fold the exact file names into the WP allowlist before completing.
- [ ] Confirm `G.cardDisplayData` is in scope at each site and `fightMastermind.ts` already resolves the mastermind name via `G.cardDisplayData?.[G.mastermind.baseCardId]?.name` (~148); `defeatedTacticId` captured ~83.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Card-play label: `{Name} ({extId})`, plus ` — {plain effect}` iff `abilityText` present and non-empty (starters: no suffix).
- Mastermind line: `fought {Mastermind} and defeated the tactic "{Tactic}".` (resolve `G.mastermind.baseCardId` → name; `defeatedTacticId` → name).
- Name fallback everywhere: `cardDisplayData?.[extId]?.name ?? extId` (the `fightVillain.ts:198` pattern) — never throws, never emits `undefined`.
- `abilityTextToPlainText`: `[type:value]` → space-padded humanized `value` (hero classes title-cased; hyphens → spaces); collapse all whitespace/newlines to single spaces; trim; tidy spaces before `.,;:`; empty/undefined → `''`.
- Helper home: new `packages/game-engine/src/log/logDisplay.ts` (justified new folder — WP-324 extends it).
- Reserved decision: **D-24109**.

## Guardrails
- **Message text only** — no change to `G` state, move logic, RNG, turn flow, or `G.cardDisplayData` shape. The only diff at each move site is the string.
- `logDisplay.ts` is **pure**: imports no `boardgame.io`, does no I/O, takes `cardDisplayData` + `extId` as args (no `G` reach-through).
- Determinism: `G.messages` is hash-excluded (D-24081) — no replay-outcome change; **re-pin** the fixture message oracle by regeneration (`scripts/record-game-fixture.mjs`), never hand-edit divergent lines.
- Single-line output — the effect suffix must never contain a raw `\n` (collapse in the converter).
- No `.reduce()` in the converter; explicit `.replace()` steps / `for...of`.
- Do NOT touch `apps/arena-client`, `notableEvents`, or the other ~37 push sites (that's WP-324).

## Required `// why:` Comments
- The name fallback `?? extId` (why: an absent cardDisplayData entry must degrade to the raw id, never throw or print undefined — the fightVillain.ts:198 pattern).
- The whitespace/newline collapse in `abilityTextToPlainText` (why: a log line is single-entry; a multi-line ability must not split the log row).
- Reuse of `G.mastermind.baseCardId` for the mastermind name (why: `.id` is the qualified "core/magneto", not a display name; baseCardId keys cardDisplayData — mirrors the ~148 notableEvent resolution).
- The new `src/log/` folder (why: home for log-message display formatting; WP-324 extends it — not a single-file folder in steady state).

## Files to Produce
- `packages/game-engine/src/log/logDisplay.ts` [`resolveCardName` + `abilityTextToPlainText` + `formatPlayedCardLabel`, pure] · `logDisplay.test.ts` [token families, multi-token, newline collapse, no-markup, undefined, name fallback, starter vs ability label].
- `packages/game-engine/src/moves/coreMoves.impl.ts` [play line → `formatPlayedCardLabel`].
- `packages/game-engine/src/moves/playFromUndercover.ts` [face-down play line → label + `from face-down`].
- `packages/game-engine/src/moves/fightMastermind.ts` [mastermind + tactic names at ~88].
- Re-pinned move test(s) (`fightMastermind.test.ts` + the play-line test — exact name from scaffold) + replay fixture(s) with a `messages` oracle.
- Governance: `docs/ai/DECISIONS.md` (D-24109), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 fail; `pnpm -r build` clean.
- [ ] `git diff --name-only` = the allowlist (helper + 3 moves + re-pinned tests/fixtures + governance).
- [ ] STATUS / DECISIONS (D-24109 Active) / WORK_INDEX (WP-323 `[x]`) / EC_INDEX (EC-353 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (live match log shows named plays with effect + named mastermind/tactic).

## Common Failure Smells
- Reaching into `G` from `logDisplay.ts` (pass `cardDisplayData` in — keep it pure and unit-testable).
- Using `G.mastermind.id` for the mastermind name (that's "core/magneto"; use `baseCardId` → cardDisplayData).
- A `\n` in a card's `abilityText` splitting the log row (collapse whitespace in the converter).
- Hand-editing fixture message lines to match instead of regenerating → drift + wrong pins.
- Changing any non-message assertion or engine state — this WP is message text only.
- Widening to recruit / fight-villain / villain-deck reveal lines — that's WP-324, out of scope here.
- Forgetting a starter (no `abilityText`) must produce `{Name} ({extId})` with **no** ` — ` suffix.
