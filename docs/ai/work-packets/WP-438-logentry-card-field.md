# WP-438 — Structured `LogEntry.card`: Retire the Last Prose-Parse in `effectProvenance`

> Follow-up to the log-outcome arc (D-24253). B.3a/b/c made the *outcome*
> authoritative; this makes the *card ext-id* structural too, so the freeze
> diagnostic stops **extracting** the ext-id from "played X ({ext-id})" prose. This
> **reduces** D-24253 §14's residual (a re-wording can no longer break the ext-id
> extraction or the condition-fail association) but does not fully eliminate it — the
> "played" line-*kind* detection stays prose; see §Context.

## Goal

Add an optional structured `card?: CardExtId` to `LogEntry`. The engine populates it
on card-attributed log lines (the "played X" line, the hero-effect handler lines, the
hollow record). The freeze diagnostic's `effectProvenance` then reads `entry.card` to
identify a played card and to associate its effect lines — **retiring the two fragile
prose parsers**: `PLAYED_LABEL_EXTID` (the ext-id extractor that grabbed "+1 recruit"
in a live freeze report, hardened by PR #980) and the B.3c `(ext-id)` substring scan
(with its RS-2 collision caveat). `text` and `outcome` are unchanged; the log renders
identically. This **reduces** the log-outcome arc's §14 residual (the fragile ext-id
extraction + the condition-fail association go structural) but does not fully close it:
the "played" line-*kind* detection (`PLAYED_LINE`) stays prose — a future `LogEntry.kind`
increment (§Context).

## Assumes

- **WP-434/435/436 (B.3a/b/c) merged** (D-24253). `LogEntry = { text, outcome }`;
  `UIState.log: LogEntry[]`; `effectProvenance` reads the authoritative `outcome` but
  still parses "played X ({ext-id})" for card **identification** and uses a
  `text.includes('(ext-id)')` scan for the condition-fail **association**.
- `CardExtId` is the engine's card-id string alias (`state/zones.types.ts`), already a
  first-class type across the engine.
- `G.messages` is hash-excluded (D-24081) — an additive record field is
  `finalStateHash`-neutral; the one sentinel fixture re-pins by regeneration.
- Baseline `origin/main` @ `48db4bf4`.

## Context (Read First)

D-24253 §14 (survival lens) promised B.3 means "the next log re-wording *cannot* break
the freeze diagnostic." B.3c (WP-436) delivered that for the *outcome determination*
(authoritative `LogEntry.outcome`) but explicitly left a residual: card
**identification** still parses the "played X" prose, and the condition-fail
**association** still does `text.includes('(ext-id)')`. The ext-id extractor
(`PLAYED_LABEL_EXTID`) is exactly the parser that broke twice (WP-328 numbering prefix,
WP-417 printed-icon clause → `extId === "+1 recruit"` in a real report; PR #980 hardened
the regex reactively). This WP removes it structurally.

**Scope decision — populate broadly, but keep the line-KIND detection as prose (the one
real fork; flagged for review).** With `LogEntry.card`, `effectProvenance` reads the
ext-id and associates effect lines **structurally** (`entry.card === extId`), retiring
`PLAYED_LABEL_EXTID` and the `(ext-id)` substring. But it still needs to know a line *is
a "played" line* to enumerate plays — that stays a `PLAYED_LINE` (`Player N played …`)
prose match, because `LogEntry` carries no line-**kind**. That prose match is far more
stable than the ext-id extractor (it has never broken), so this WP **keeps it** and does
NOT add a `LogEntry.kind` field — that is the *next* increment if even the "played"
phrasing ever churns. This WP's win: the fragile *extraction* and the *association* both
go structural; the stable *kind* detection stays prose. (Alternative, larger: add
`LogEntry.kind` too and drop `PLAYED_LINE` — deferred, noted, not scoped here.)

**Reveal-line attribution (locked, behavior-preserving).** The reveal-outcome line names
the *revealed* deck-top card; its `card` is that revealed ext-id — **not** the played
What-If card. So `effectProvenance`'s `entry.card === playedExtId` correctly does **not**
attribute it to the played card (preserving B.3c's exclusion, now structurally instead of
by substring-mismatch). This eliminates the RS-2 substring-collision concern entirely.

## Scope (In)

- **`log/logOutcome.types.ts`** — `LogEntry` gains `card?: CardExtId` (optional;
  absent = a non-card line, e.g. turn/phase narration, scheme/master-strike lines).
  Import `CardExtId` (type-only).
- **`log/logPush.ts`** — `pushLog(G, message, outcome = 'neutral', card?)` builds
  `card` into the record when supplied. `logPush.test.ts` updated.
- **Emission sites pass `card`** (the sites that already hold the `cardId`):
  `moves/coreMoves.impl.ts` `applyCardPlay` (the "played X" line) +
  `moves/playFromUndercover.ts`; `hero/heroEffects.execute.ts` draw/attack/recruit/
  self-KO/condition-failed handlers; `diagnostics/hollowEffect.record.ts` (the
  `record.cardId`). The reveal-outcome line passes the **revealed** card's ext-id.
  Their tests updated.
- **`test/fixtures/fixtureSchema.ts`** — the messages oracle validates an optional
  `card` (string when present). `test/fixtures/replayFixtures.test.ts` deep-compares it
  (already does, via `stableStringify`). `sentinel-core-doom-2p.replay.json`
  **regenerated** — `finalStateHash` byte-unchanged.
- **`apps/arena-client/src/diagnostics/effectProvenance.ts`** — enumerate played cards
  by `PLAYED_LINE` (kept) but take the ext-id from `entry.card` (fallback to the parsed
  label only when `card` is absent, for legacy/degraded snapshots); the condition-fail
  association matches `entry.card === extId && entry.outcome === 'blocked'` within the
  play-window, replacing the `(ext-id)` substring. **Delete** `PLAYED_LABEL_EXTID` /
  `extractPlayedExtId` once `card` is the source. `effectProvenance.test.ts` updated
  (fixtures seed `card`).

## Out of Scope

- `LogEntry.kind` (line-kind field) / dropping `PLAYED_LINE` — the further increment.
- Any `text` or `outcome` change; the log renders identically (B.3b colours unchanged).
- Server, registry, persistence-schema (`MatchSnapshot.messages` stays `string[]` —
  it flattens `.text`, D-24253 PS-4, so `card` never reaches the persisted snapshot),
  scoring, determinism behavior.
- `awaitingPlayerInput`, the `hollowEffects` read — unchanged.

## Files Expected to Change

**game-engine:** `log/logOutcome.types.ts` · `log/logPush.{ts,test.ts}` ·
`moves/coreMoves.impl.ts` · `moves/playFromUndercover.ts` ·
`hero/heroEffects.execute.{ts,test.ts}` · `diagnostics/hollowEffect.record.ts` ·
`test/fixtures/fixtureSchema.ts` · `test/fixtures/replayFixtures.test.ts` ·
`test/fixtures/games/sentinel-core-doom-2p.replay.json` [regen] · (plus any handler
test the scaffold surfaces — locked mechanical addition of a `card` arg).
**arena-client:** `diagnostics/effectProvenance.{ts,test.ts}` · `fixtures/*` [seed
`card` on played-line fixtures where a test asserts identification].
**governance:** `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`STATUS.md`, `docs/ai/DECISIONS.md` (**D-24257**).

Cross-layer atomic (engine `LogEntry` + arena-client consumer) per the D-24253 §10
pattern — an engine `LogEntry` change surfaces in arena-client typecheck, so they land
together. Two-session lane.

## Contract

- `LogEntry = { text: string; outcome: LogOutcome; card?: CardExtId }` — `card`
  **optional and additive**; absent lines behave exactly as today.
- `pushLog(G, message, outcome?, card?)`.
- `effectProvenance` reads `entry.card` for the ext-id + condition-fail association;
  `PLAYED_LINE` line-kind detection retained; `PLAYED_LABEL_EXTID` + the `(ext-id)`
  substring scan removed. `EffectProvenance` / `PlayedCardOutcome` output shapes
  unchanged.
- Reserves **D-24257** (extends D-24253).

## Acceptance Criteria

1. `LogEntry.card` is optional; the "played X" line, the hero-effect handler lines, and
   the hollow record carry the source `cardId`; narration lines carry none.
2. `effectProvenance` identifies played cards' ext-ids from `entry.card` (not
   `PLAYED_LABEL_EXTID`) and associates condition-fail via `entry.card === extId`;
   `PLAYED_LABEL_EXTID` + the `(ext-id)` substring are deleted. A `card`-less **legacy
   saved** snapshot degrades gracefully: identification falls back to the parsed label
   and never throws, and the condition-fail **association** downgrades to `resolved`
   (it needs `entry.card`) — an accepted, documented downgrade, because a **live**
   snapshot always carries `card` and only a re-run over a stale saved diagnostic blob
   is affected. The `(ext-id)` substring is **not** reintroduced as a fallback (that is
   the RS-2 fragility this WP retires).
3. Behavior preserved: the WP-436 outcome cases (`hollow` / `conditionNotMet` /
   `awaitingChoice` / `resolved`) classify identically on the same inputs; the reveal
   line is NOT attributed to the played card.
4. `finalStateHash` byte-unchanged (fixture regenerated); `G.messages` still
   hash-excluded; `text`/`outcome` values unchanged (log renders identically).
5. Engine + arena-client `test` + `typecheck` 0; `pnpm -r build` 0.

## Verification Steps

1. `pnpm -r build && pnpm -r --no-bail test` — green; arena-client `typecheck` 0.
2. Regenerate + diff the sentinel fixture: `card` fields added, `finalStateHash`
   unchanged, all `text`/`outcome` values byte-identical.
3. Feed a real diagnostic snapshot through `buildEffectProvenance`. With `card` on the
   lines, `recentlyPlayedCards` outcomes match WP-436 and identification comes from
   `card`. Without `card` (legacy blob), identification still resolves via the label
   fallback and `resolved`/`hollow`/`awaitingChoice` cases are identical — but a
   condition-fail **downgrades to `resolved`** (per AC-2, the accepted legacy behavior),
   NOT identical; do not treat that as a failure.
4. `git diff --name-only` = the allowlist (+ scaffold-surfaced handler tests).

## Definition of Done

- All AC met; both suites + build green.
- Governance closed: WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅` +
  `roadmap:counts:write`, STATUS entry, **D-24257 Active** (recording the §14 residual
  as **reduced to line-kind detection**, deferred to a future `LogEntry.kind` — NOT
  fully resolved).
- `User-Visible Surface = none` (log renders identically; `card` is diagnostic metadata,
  not shown) — **D-24026 N/A**; state the reason.

## Lint Gate Self-Review (00.3 — 21 sections)

1. **Scope** — PASS (allowlist boundary; §Scope In/Out enumerated).
2. **Layer boundary** — PASS (engine authors `card`; arena-client reads it; the
   cross-layer atomicity is justified per D-24253 §10; no server/registry/pg).
3. **Determinism** — PASS (`G.messages` hash-excluded D-24081; `card` deterministic;
   fixture regenerated, hash unchanged; `computeStateHash` note: it serializes messages
   deterministically incl. `card`, run-vs-run stable — `PRE_WP080_HASH`'s replay has
   empty messages, unchanged).
4. **Persistence** — PASS (`MatchSnapshot.messages` stays `string[]` via the `.text`
   flatten — `card` never persisted; snapshots counts+text only).
5. **Contract files** — N/A (`logOutcome.types.ts` is an engine type extended additively,
   not an A-packet `.types/.validate/.gating` contract file; the additive optional field
   follows the MATCH-SETUP-envelope-extensibility precedent).
6. **Naming** — PASS (`card`, `CardExtId`).
7. **Canonical arrays** — N/A (`LOG_OUTCOMES` unchanged).
8. **Moves never throw** — PASS (pushLog guards; no move-throw added).
9. **Phase/turn `// why:`** — N/A.
10. **`.reduce()` ban** — PASS.
11. **Error messages** — N/A.
12. **Comments explain why** — PASS (EC required-comments: why `card` is optional, why
    `PLAYED_LINE` stays but `PLAYED_LABEL_EXTID` goes, the reveal-line attribution).
13. **Test extension** — PASS.
14. **`makeMockCtx`** — N/A.
15. **Field-name fidelity** — PASS (`card`/`CardExtId` per engine convention).
16. **Vision alignment** — PASS (§14 observability/robustness).
17. **No invented mechanics** — PASS (metadata field; no rule/counter).
18. **DECISIONS** — PASS (reserves D-24257; extends D-24253).
19. **API catalog (D-11804)** — N/A.
20. **Mindmap node** — PASS.
21. **User-visible surface / D-24026** — PASS (N/A-with-reason: metadata, not rendered).

All 21 resolved (PASS or justified N/A).

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE** (independent subagent, 2026-07-27), zero blockers. Verified all 7
load-bearing claims against the code: B.3a/b/c baseline; every named emission site holds
the `cardId`; `pushLog`'s signature is additive-safe; the reveal line names the
*revealed* card (so `entry.card === playedExtId` never matches — B.3c non-attribution
preserved structurally); `MatchSnapshot.messages` stays `string[]` via the `.text`
flatten; and **both hash oracles are safe** (`finalStateHash` rest-destructures
`messages` out per D-24081; `PRE_WP080_HASH` runs over an empty-moves replay so no
`card` key is ever added). Folded pre-flight RS-1 (type-only import comment) + RS-3
(don't strip `card` in the audience filter) into the EC.

## Copilot Check Verdict (01.7)

**PASS** (independent subagent, 2026-07-27), after **RISK/HOLD** on two honesty findings,
both fixed: (1) the §14 framing was reworded from "resolves the residual" to **reduces**
it (the `PLAYED_LINE` line-kind detection stays prose — a future `LogEntry.kind`
increment); (2) AC-2 now documents that a `card`-less **legacy saved** snapshot
downgrades a condition-fail to `resolved` (association needs `card`) — accepted because
live snapshots always carry `card`, and the `(ext-id)` substring is NOT reintroduced.
The technical core (determinism on both hash oracles, boundary cleanliness, emission-site
coverage, reveal-line attribution) passed clean on both the pre-flight and copilot.
