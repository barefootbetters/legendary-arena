# EC-473 — Structured `LogEntry.card`: Retire the Last Prose-Parse in `effectProvenance` (Execution Checklist)

**Source:** docs/ai/work-packets/WP-438-logentry-card-field.md
**Layer:** game-engine (LogEntry + pushLog + emission sites + oracle) **+** arena-client (effectProvenance) — landed atomically (D-24253 §10 pattern). No server/registry/persistence change.
**Lane:** Standard, two-session. Follow-up to the D-24253 log-outcome arc; resolves the B.3c §14 residual (card identification stops parsing prose).

## Before Starting
- [ ] Worktree off `main`, clean, synced; baseline `origin/main` @ `48db4bf4` recorded.
- [ ] Confirm B.3a/b/c on `main`: `LogEntry = { text, outcome }`; `effectProvenance` uses `PLAYED_LABEL_EXTID` for the ext-id + a `(ext-id)` substring for the condition-fail association (the two retirement targets); `PLAYED_LINE` for line-kind (KEPT).
- [ ] **Scaffold-first** (additive contract migration): after the type + `pushLog` change, run `pnpm --filter @legendary-arena/game-engine test` then arena-client `typecheck` and fold every surfaced handler-test `card`-arg addition in under the locked transform.
- [ ] Target file set = WP-438 `## Files Expected to Change`. Non-migration edits outside it are a FAIL.

## Locked Values (do not re-derive)
- `LogEntry = { text: string; outcome: LogOutcome; card?: CardExtId }` — `card` **optional, additive**; `import type { CardExtId }` (type-only).
- `pushLog(G, message, outcome: LogOutcome = 'neutral', card?: CardExtId)` — 4th optional arg; builds `card` into the record only when supplied (omit the key when undefined, so narration lines stay `{ text, outcome }`).
- **Emission sites that pass `card`** (they already hold the `cardId`): `applyCardPlay` (played line) + `playFromUndercover`; `heroEffectDraw`/`Attack`/`Recruit`/self-`Ko`/condition-failed; `hollowEffect.record.ts` (`record.cardId`). The **reveal-outcome** line passes the **revealed** deck-top card's ext-id (NOT the played card — preserves B.3c exclusion structurally).
- **`effectProvenance` (arena-client):** enumerate plays via `PLAYED_LINE` (KEPT), but take the ext-id from `entry.card` — fall back to `extractPlayedExtId(label)` ONLY when `entry.card` is absent (legacy/degraded snapshot). Condition-fail association = a play-window line with `entry.card === extId && entry.outcome === 'blocked'` → `conditionNotMet`. **Delete** `PLAYED_LABEL_EXTID` + `extractPlayedExtId` once `card` is the primary source (keep a minimal label fallback inline). Hollow-first order (WP-436) unchanged; `awaitingPlayerInput` unchanged.
- Fixture: `sentinel-core-doom-2p.replay.json` **regenerated**, `finalStateHash` byte-identical; `fixtureSchema.ts` validates optional `card` (string when present).

## Guardrails
- **`card` is optional + additive** — a line without it behaves exactly as today; do NOT make it required (that would break narration lines + force every caller).
- **No `text`/`outcome` change** — the log renders identically (B.3b colours untouched); a `text` diff on any existing line is a FAIL. `card` is metadata, never rendered.
- **Determinism** — `G.messages` hash-excluded (D-24081); regenerate the fixture, never hand-edit; `finalStateHash` byte-identical. `MatchSnapshot.messages` stays `string[]` (the `.text` flatten drops `card` — do NOT add `card` to the persisted snapshot).
- **Keep `PLAYED_LINE`** (line-kind) — this WP retires the ext-id *extraction* and the *association* substring, NOT the "played" line detection (a `LogEntry.kind` field is the separate future increment).
- **Reveal line = revealed card's ext-id** — so `entry.card === playedExtId` never matches it; this replaces the RS-2 substring guard structurally.
- Pure helpers stay pure; `effectProvenance` `import type` only from the engine; fail-soft (a `card`-less snapshot degrades to the label fallback, never throws). No `.reduce()`.
- **Audience filter (RS-3):** `card` now rides `UIState.log` — it is public info (the played-card id / the revealed deck-top the line's `text` already names), so **do NOT strip it** in `filterUIStateForAudience` (stripping it defeats the WP) and no new filter is needed for it.
- **Type-only import cycle (RS-1):** `import type { CardExtId }` in `logOutcome.types.ts` closes a `logOutcome.types → zones.types → types.ts → logOutcome.types` cycle — HARMLESS because all edges are `import type` (erased at emit). Keep it `import type`; never convert to a value import.

## Required `// why:` Comments
- `LogEntry.card`: why optional (narration lines have no card; additive keeps every existing caller valid), AND a `// why: type-only — keeps the zones.types↔types.ts cycle erased` on the `CardExtId` import.
- The reveal-outcome `card = revealed ext-id`: why it's the revealed (not played) card — so provenance doesn't attribute a What-If reveal to the played card (B.3c behavior, now structural).
- The condition-fail association: a `// why:` that on a `card`-less legacy saved snapshot the association downgrades to `resolved` (needs `entry.card`), accepted because live snapshots always carry `card`; and why the `(ext-id)` substring is NOT reintroduced as a fallback (it is the RS-2 fragility being retired).
- `effectProvenance`: why `PLAYED_LINE` stays but `PLAYED_LABEL_EXTID` goes (line-kind vs the fragile extraction that broke in WP-328/417); why the label fallback remains for `card`-less snapshots.

## Files to Produce
- `log/logOutcome.types.ts` [+`card?: CardExtId`] · `log/logPush.{ts,test.ts}` [4th arg].
- `moves/coreMoves.impl.ts` · `moves/playFromUndercover.ts` · `hero/heroEffects.execute.{ts,test.ts}` · `diagnostics/hollowEffect.record.ts` [pass `card`].
- `test/fixtures/fixtureSchema.ts` [optional `card`] · `test/fixtures/replayFixtures.test.ts` · `test/fixtures/games/sentinel-core-doom-2p.replay.json` [regen].
- arena-client: `diagnostics/effectProvenance.{ts,test.ts}` · `fixtures/*` [seed `card` where a test asserts identification].
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `STATUS.md`, `docs/ai/DECISIONS.md` (D-24257).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` + arena-client `test`/`typecheck` 0; `pnpm -r --no-bail test` green; `pnpm -r build` 0.
- [ ] `git diff` proves fixture `finalStateHash` unchanged + every existing `text`/`outcome` unchanged (only `card` added). `git diff --numstat -- packages/lagn-spec/schemas/lagn-v1.json` empty.
- [ ] STATUS / DECISIONS (D-24257 Active; D-24253 §14 residual resolved) / WORK_INDEX `[x]` / EC_INDEX Done; mindmap `📝 → ✅` + `roadmap:counts:write`.
- [ ] `User-Visible Surface = none` → **D-24026 N/A** (log renders identically; `card` is diagnostic metadata) — state the reason.

## Common Failure Smells
- Making `card` required, or adding `card: undefined` keys to narration lines (churns the fixture + every caller).
- A `text` diff on an existing line — this WP adds metadata only.
- Attributing the reveal line to the played card (its `card` must be the REVEALED ext-id).
- Deleting `PLAYED_LINE` (line-kind — out of scope; only the extraction + association go).
- Dropping the `card`-less label fallback → a legacy snapshot throws or mis-identifies.
- Adding `card` to `MatchSnapshot.messages` (it stays `string[]`; the flatten drops it).
- Hand-editing the fixture oracle instead of regenerating.
