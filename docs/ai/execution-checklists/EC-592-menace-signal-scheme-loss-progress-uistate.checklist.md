# EC-592 — Menace Signal: Scheme Loss Progress → UIState

**WP:** [WP-557](../work-packets/WP-557-menace-signal-scheme-loss-progress-uistate.md)
**Layer:** Game Engine (only)
**Lane:** Standard two-session
**Reserves:** D-24366

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Confirm on `origin/main` at or after `a426b67d`; working tree clean.
- [ ] `pnpm -r build` exits 0 **before** editing (stale `dist` fakes failures).
- [ ] Record the baseline: `pnpm --filter @legendary-arena/game-engine test`
      count, and the current sentinel `finalStateHash` / `PRE_WP080_HASH`.
- [ ] Record `pnpm --filter arena-client typecheck` as green **at baseline** —
      it must still be green at the end with zero arena-client edits.
- [ ] Read `schemeHandlers.ts:160-188` — the inline resolution being extracted.

## Locked Values

- `MVP_SCHEME_TWIST_THRESHOLD = 7` — the existing module-private constant.
  Move it with the extraction; do **not** re-type it as 8.
- Denominator resolution order: `resourceLossCondition.threshold` →
  `lossThresholdByPlayerCount[String(lobby.requiredPlayers)]` →
  `lossThreshold` → `7`.
- Tier bands, half-open on the lower bound:
  `menace < 0.34` → `calm`; `>= 0.34 && < 0.67` → `rising`; `>= 0.67` → `critical`.
- `MenaceTier = 'calm' | 'rising' | 'critical'`; `MENACE_TIERS` in that order.
- Four new `UIProgressCounters` fields, all **optional in the type**:
  `menace`, `menaceTier`, `schemeLossProgress`, `schemeLossThreshold`.
- `pile-depleted` schemes: omit `schemeLossThreshold`; derive `menace` from
  the twist proxy. Never invent a denominator.
- `SCHEME_TWIST_CONFIGS` is a **`Map<string, SchemeTwistConfig>`**
  (`schemeTwistConfigs.ts:32`). Read it with `.get(schemeId)` — **never**
  object-index access.

## Guardrails

1. **Projection-only.** Never add a `G` field. Never persist. The derivation
   runs in `buildUIState`, not in a move, effect, or handler.
2. **One copy of the denominator rule.** `schemeHandlers.ts` MUST call the
   extracted resolver. Leaving its inline copy in place — or duplicating the
   order into the new helper — is the defect this packet exists to prevent.
3. **The extraction is behavior-identical.** If a scheme-handler test needs
   editing to pass, the extraction is wrong. Fix the helper, not the test.
4. **Pure helper.** `schemeLossProgress.ts` imports no `boardgame.io`, no
   registry, no `apps/*`. No `ctx.random`. No `.reduce()` in the derivation.
5. **Zero arena-client edits.** `git diff --name-only -- apps/arena-client`
   MUST be empty at the end. If a fixture breaks, the field was made required
   — revert to optional rather than backfilling fixtures.
6. **No divide-by-zero.** A zero or absent denominator must never produce
   `NaN` or `Infinity`; it takes the locked fallback path.
7. **Extend the drift pin.** The existing `UIProgressCounters` keyset
   assertion passes silently on an optional add — it must be extended, or the
   new names ship unprotected.
8. **Hashes unchanged.** Both sentinel oracles stay byte-identical. If either
   moves, STOP — a projection-only change cannot move a hash, so something
   reached `G`.

## Required Comments

- `// why:` on the extracted resolver, citing **D-24178** for the order and
  **D-24315** for the `resourceLossCondition` suppression.
- `// why:` on the `pile-depleted` fallback branch, stating that the pile's
  starting size is not a scheme constant so no denominator exists.
- `// why:` on the four optional field declarations in `uiState.types.ts`,
  citing the WP-410 pattern and naming the consequence (a required add breaks
  arena-client `vue-tsc`, a package this WP declares out of scope).
- `// why:` on the audience-filter test, noting the fields ride the
  `progress` spread at `uiState.filter.ts:476` and that the test pins that
  spread against a future field-by-field rewrite.

## Files to Produce

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeLossProgress.ts` | new — resolver, numerator, `computeMenace`, `menaceTierFor`, `MENACE_TIERS` |
| `packages/game-engine/src/rules/schemeLossProgress.test.ts` | new |
| `packages/game-engine/src/rules/schemeHandlers.ts` | call the extracted resolver |
| `packages/game-engine/src/ui/uiState.types.ts` | four optional fields + `MenaceTier` |
| `packages/game-engine/src/ui/uiState.build.ts` | populate all four |
| `packages/game-engine/src/ui/uiState.build.progress.test.ts` | projection assertions |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | audience-filter survival |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | extend the keyset pin |
| `packages/game-engine/src/index.ts` | export `MenaceTier` / `MENACE_TIERS` |
| `.claude/rules/code-style.md` | add `MENACE_TIERS` to Drift Detection |
| `wiki/sound-effects.md` | correct the retired-formula paragraph |

Governance ledgers excluded per `01.5`.

## After Completing

- [ ] `WORK_INDEX.md` row → `[x]` with observed counts and hash verdict.
- [ ] `EC_INDEX.md` status → `Done`.
- [ ] Mindmap node → `✅`; `pnpm roadmap:counts:write` then `:check` exits 0.
- [ ] **D-24366** landed **Active** in `DECISIONS.md`.
- [ ] `STATUS.md` — the inverted D-24026 line: no user-observable change.
- [ ] Name the two consumer packets (danger-meter HUD, adaptive music) in
      the `WORK_INDEX.md` row so the contract's consumers are discoverable.

## Common Failure Smells

- **"The filter needs no test because `progress` is spread."** The spread is
  exactly what the test pins. A future field-by-field rewrite of the filter
  is the shipped EC-206 failure mode; the test is the tripwire.
- **Making the fields required "for type safety."** It breaks arena-client
  `vue-tsc` and drags an out-of-scope package into the diff.
- **Re-deriving the threshold in `uiState.build.ts`** because importing from
  `rules/` "feels wrong from `ui/`." Both are engine-internal; the import is
  fine and the second copy is the bug.
- **Using `8` anywhere.** The MVP fallback is `7`. `8` is the arena-client's
  hardcoded lie and the Civil War 2–3p value; neither is a default.
- **Re-recording a fixture because a hash moved.** A projection-only change
  cannot move a hash. Find what reached `G` instead.
- **Indexing `SCHEME_TWIST_CONFIGS` like an object.** It is a `Map`. Index
  access returns `undefined` for every scheme, silently collapsing every
  denominator to the fallback `7` — the exact defect the WP-557 draft
  scaffold hit. The scheme-handler suite catches it (6 failures: Cosmic
  Cube's 8-vs-7 test plus five suppression tests), so trust the red.
