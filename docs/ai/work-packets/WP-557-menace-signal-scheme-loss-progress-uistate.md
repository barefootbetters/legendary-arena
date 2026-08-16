# WP-557 — Menace Signal: Scheme Loss Progress → UIState (Game Engine)

**Status:** Drafted 2026-08-16
**EC:** [EC-592](../execution-checklists/EC-592-menace-signal-scheme-loss-progress-uistate.checklist.md)
**Reserves:** D-24366
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure (its consumers are the follow-on App WPs)
**Drafted off:** `origin/main` @ `a426b67d`

---

## Goal

Project how close the villains are to winning as a single engine-derived
signal on `UIState`: the active scheme's **real** loss numerator and
denominator, a normalized `menace` scalar in `0..1`, and a `MenaceTier`
band. Today the arena-client cannot compute any of this — it has no access
to the per-scheme loss threshold — so the one progress readout that exists
prints a hardcoded denominator that is wrong for most schemes. This packet
builds the signal and locks the tier contract once, so the two planned
consumers (the danger-meter HUD, and the adaptive danger-meter music the
ewiki [Sound Effects](https://ewiki.legendary-arena.com/sound-effects/) page
specifies) read the same derivation instead of two copies that drift apart.

## Assumes

- **D-24178** — the twist-count doom-clock proxy and its threshold
  resolution order (`lossThresholdByPlayerCount` → `lossThreshold` →
  MVP fallback). Locked in `schemeHandlers.ts:162-178`.
- **D-24315** — a scheme declaring a `resourceLossCondition` has the
  twist-count proxy **suppressed**; its real Evil-Wins condition governs.
  Locked in `schemeHandlers.ts:180-185` and
  `schemeTwistConfig.types.ts:37-59`.
- **D-24317** — the generic `escapedVillains >= ESCAPE_LIMIT` loss was
  **retired**. Locked in `endgame.evaluate.ts:51-56`.
- **WP-409 / D-24221** — the precedent for projecting an observability-only
  scalar onto `UIState` with zero determinism footprint.
- **WP-410 / D-24222** — the precedent for adding a **type-optional**
  `UIState` field that `buildUIState` always populates, so no hand-written
  arena-client fixture needs a backfill.
- **D-24246** — the Combo Tier Contract precedent: a tier boundary set
  locked **once** and inherited by both an audio and a visual consumer.
- `UIProgressCounters` exists and is a required `UIState` field (WP-067).

## Context

**Why now.** The ewiki Sound Effects page specifies an adaptive score driven
by a "danger meter" and asserts the signal is *confirmed projected*. That is
half-true, and the untrue half blocks the whole arc.

**What is actually projected.** The **numerators** are:
`UIState.progress.escapedVillains` ([uiState.build.ts:366](../../../packages/game-engine/src/ui/uiState.build.ts))
and `UIState.scheme.twistCount`. The **denominators** are not — a grep of
`packages/game-engine/src/ui/` for `twistLimit|schemeLoss|ESCAPE_LIMIT`
returns zero matches. The client therefore cannot form a ratio at all.

**The observable consequence.** `PlayDesktop.vue:530` and
`PlayMobile.vue:360` each pass a literal `:scheme-twist-threshold="8"` into
`TopHudBar`, which renders `Twists: {{ twistCount }}/8`. That denominator is
wrong three ways: the unconfigured-scheme fallback is **7**
(`MVP_SCHEME_TWIST_THRESHOLD`, `schemeHandlers.ts:29`), Super Hero Civil War
is 8 at 2–3 players but **5** at 4–5 (`schemeTwistConfigs.ts:135`), and any
scheme declaring a `resourceLossCondition` does not lose on twist count at
all. Fixing that readout is the follow-on App packet's job; it cannot be
fixed without this one.

**The stale formula.** The ewiki page's
`escapeProgress = escapedVillains / ESCAPE_LIMIT` predates **D-24317**,
which retired the generic escape loss. Escapes now advance loss progress
only through a scheme's own `escaped-pile-count` /
`escaped-converted-count` condition. Shipping the page's formula literally
would render a meter that fills toward a threshold that no longer ends the
game. This packet corrects the page in lockstep.

**Why the denominator rule must be extracted, not copied.** The resolution
order lives **inline in the twist dispatcher**
(`schemeHandlers.ts:175-185`), and `MVP_SCHEME_TWIST_THRESHOLD` is
module-private. A projection that re-implements it creates a second copy of
the loss rule — precisely the failure the penalty-producer arc already paid
for, where two derivations had to be kept symmetric by hand. This packet
extracts the resolution into one shared pure helper that the dispatcher and
the projection both call. That makes the change a **small refactor plus an
addition**, not strictly additive, which is one reason it takes the standard
two-session lane rather than the lightweight lane.

**Why one WP and not three.** Splitting at the layer boundary is deliberate.
This packet is engine-only and ships no pixel; the danger-meter HUD (which
also lands the `/8` fix) and the adaptive music channel are separate App
packets, each with its own surface and its own live-verification. Folding
them together would put ~14 files and three unrelated verifications in one
packet.

## Scope (In)

1. A new pure helper module `packages/game-engine/src/rules/schemeLossProgress.ts`:
   - `resolveSchemeLossThreshold(gameState)` — the D-24178 resolution order,
     **extracted verbatim** from `schemeHandlers.ts` so there is one copy.
   - `resolveSchemeLossProgress(gameState)` — the condition-aware numerator
     (twist count, or the matching escaped-pile count for a
     `resourceLossCondition` scheme).
   - `computeMenace(gameState)` — the clamped `0..1` scalar.
   - `menaceTierFor(menace)` — the band mapping.
   - `MENACE_TIERS` canonical readonly array + `MenaceTier` union.
2. `schemeHandlers.ts` refactored to call `resolveSchemeLossThreshold`
   instead of its inline copy. **Behavior-identical** — the extraction
   preserves the existing priority order and the MVP fallback exactly.
3. `uiState.types.ts` — `UIProgressCounters` gains four **optional** fields:
   `menace`, `menaceTier`, `schemeLossProgress`, `schemeLossThreshold`.
4. `uiState.build.ts` — always populates all four.
5. Tests: helper unit tests (resolution order, suppression, clamping, tier
   boundaries), a build-projection test, an **audience-filter test**, and an
   extension of the `UIProgressCounters` drift pin covering the new names.
6. `.claude/rules/code-style.md` — add `MENACE_TIERS` to the Drift Detection
   canonical-array list (the WP-434 `LOG_OUTCOMES` precedent).
7. `wiki/sound-effects.md` — correct the stale `escapedVillains /
   ESCAPE_LIMIT` formula to the shipped signal and name the tier contract.

## Scope (Out)

- **Every `apps/arena-client` file.** No component, no composable, no
  fixture. The hardcoded `:scheme-twist-threshold="8"` fix belongs to the
  follow-on Danger Meter HUD packet.
- **Any audio.** No music channel, no loop, no crossfade, no ducking.
- **Any `G` field.** `menace` is derived at projection time only.
- Any change to scheme twist **configs** or to the loss rules themselves —
  this packet reads them, it does not alter what any scheme does.
- Any change to `ESCAPE_LIMIT` or to `endgame.evaluate.ts`.
- Any new `NotableGameEvent` variant.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeLossProgress.ts` | **new** — the pure helper + `MENACE_TIERS` |
| `packages/game-engine/src/rules/schemeLossProgress.test.ts` | **new** — resolution order, suppression, clamp, tiers |
| `packages/game-engine/src/rules/schemeHandlers.ts` | call the extracted resolver (behavior-identical) |
| `packages/game-engine/src/ui/uiState.types.ts` | four optional `UIProgressCounters` fields + `MenaceTier` re-export |
| `packages/game-engine/src/ui/uiState.build.ts` | populate the four fields |
| `packages/game-engine/src/ui/uiState.build.progress.test.ts` | projection assertions |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | audience-filter survival test |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | extend the `UIProgressCounters` pin |
| `packages/game-engine/src/index.ts` | export `MenaceTier` / `MENACE_TIERS` |
| `.claude/rules/code-style.md` | add `MENACE_TIERS` to the canonical-array list |
| `wiki/sound-effects.md` | correct the stale formula |

Governance ledgers (`WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md`,
`05-ROADMAP-MINDMAP.md`, `STATUS.md`) are excluded from the count per
`01.5`.

## Contract

```ts
export type MenaceTier = 'calm' | 'rising' | 'critical';

export const MENACE_TIERS: readonly MenaceTier[] = ['calm', 'rising', 'critical'];

export interface UIProgressCounters {
  bystandersRescued: number;
  escapedVillains: number;
  /** Normalized 0..1 progress toward the active scheme's Evil-Wins condition. */
  menace?: number;
  /** The band `menace` falls in. */
  menaceTier?: MenaceTier;
  /** Condition-aware numerator (twists, or matching escaped-pile entries). */
  schemeLossProgress?: number;
  /** The resolved denominator for the active scheme. */
  schemeLossThreshold?: number;
}
```

**Locked — denominator resolution order** (D-24366 §1), in priority:

1. `resourceLossCondition.threshold` when the scheme declares one with a
   numeric threshold (`escaped-pile-count`, `escaped-converted-count`).
2. `lossThresholdByPlayerCount[String(lobby.requiredPlayers)]`.
3. `lossThreshold`.
4. `MVP_SCHEME_TWIST_THRESHOLD` (7).

**Locked — tier bands** (D-24366 §3), half-open on the lower bound:

| `menace` | tier |
|---|---|
| `< 0.34` | `calm` |
| `>= 0.34` and `< 0.67` | `rising` |
| `>= 0.67` | `critical` |

**Locked — the `pile-depleted` fallback** (D-24366 §5): a `pile-depleted`
condition (Civil War's `heroDeck`, Legacy Virus's `wounds`) has **no fixed
denominator** — the loss is "the pile reached zero", whose starting size is
not a scheme constant. Such a scheme projects `schemeLossThreshold`
**omitted** and `menace` derived from the twist count against the D-24178
proxy threshold, which is the doom clock those schemes already run on. It
MUST NOT invent a denominator.

**Locked — optionality rationale:** all four fields are optional **in the
type** and always populated by `buildUIState`. This is the WP-410 pattern
and exists so no hand-written arena-client `UIState` fixture requires a
backfill — a required add there breaks `vue-tsc` in a package this packet
declares out of scope.

## Acceptance Criteria

- **AC-1** — `resolveSchemeLossThreshold` returns, for each rung of the
  locked order: a `resourceLossCondition` threshold; a player-count entry
  (Civil War → 8 at 3p, 5 at 4p); a scalar `lossThreshold`; and `7` for an
  unconfigured scheme.
- **AC-2** — `schemeHandlers.ts` is **behavior-identical** after the
  extraction: the existing scheme-handler suite passes unchanged, with no
  test edited to accommodate the refactor.
- **AC-3** — `resolveSchemeLossProgress` counts matching escaped-pile
  entries for a `resourceLossCondition` scheme and twist count otherwise.
- **AC-4** — `computeMenace` clamps to `0..1`: a scheme past its threshold
  yields exactly `1`, never `> 1`.
- **AC-5** — `menaceTierFor` returns the locked band at each boundary,
  tested at `0`, `0.33`, `0.34`, `0.66`, `0.67`, `1`.
- **AC-6** — `buildUIState` populates all four fields on a real game state,
  and `MENACE_TIERS` matches the `MenaceTier` union via a drift pin.
- **AC-7** — an audience-filter test asserts all four fields survive
  `filterUIStateForAudience` for **every** audience. (They ride the
  `progress: { ...uiState.progress }` spread at `uiState.filter.ts:476`, so
  no filter edit is expected — the test pins that the spread keeps them,
  satisfying step 4 of the Board-Visible Field Rule.)
- **AC-8** — the drift test's `UIProgressCounters` keyset assertion is
  **extended** to cover the four new names. The existing assertion pins a
  two-key literal and an optional add passes it silently, so without this
  extension the new fields ship with no drift protection.
- **AC-9** — a `pile-depleted` scheme omits `schemeLossThreshold` and still
  produces a `menace` from the twist proxy (never `NaN`, never `Infinity`).
- **AC-10** — **determinism:** every sentinel `finalStateHash` and
  `PRE_WP080_HASH` is byte-unchanged. No `G` field is added; the derivation
  is projection-only. No re-pin.
- **AC-11** — `pnpm -r build` exits 0 and `pnpm -r --no-bail test` shows no
  new failures repo-wide — in particular `apps/arena-client` typecheck stays
  green with **zero fixture edits**, proving the optionality choice.
- **AC-12** — `wiki/sound-effects.md` no longer states the retired
  `escapedVillains / ESCAPE_LIMIT` formula; the wiki link-check passes.

## Verification Steps

1. `pnpm -r build` → exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green, count up by
   the new helper/projection/filter/drift tests.
3. `pnpm --filter arena-client typecheck` → 0 errors, **no fixture edited**
   (`git diff --name-only -- apps/arena-client` is empty).
4. `pnpm -r --no-bail test` → no new failures repo-wide.
5. Confirm the sentinel hashes: re-record via the canonical recorder and
   verify a no-op diff (AC-10).
6. `pnpm roadmap:counts:check` → exits 0.
7. Wiki link-check → passes.

## Definition of Done

- [ ] All twelve Acceptance Criteria demonstrated with observed output.
- [ ] `pnpm -r build` 0; game-engine suite green; `pnpm -r --no-bail test`
      no new failures.
- [ ] `apps/arena-client` untouched — verified by an empty
      `git diff --name-only -- apps/arena-client`.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-unchanged.
- [ ] D-24366 landed **Active** in `DECISIONS.md`.
- [ ] `WORK_INDEX.md` row flipped `[x]`; `EC_INDEX.md` status `Done`;
      mindmap node flipped `✅` and `pnpm roadmap:counts:check` exits 0.
- [ ] `STATUS.md` carries the "no user-observable change — infrastructure"
      line (the D-24026 gate inverts; this packet ships no surface).
- [ ] The two follow-on packets are named in `WORK_INDEX.md` as the
      consumers of this contract.

## Gate Verdicts (Drafting Session, 2026-08-16)

**Pre-flight (`01.4`): READY TO EXECUTE.**
Artifact: `docs/ai/invocations/preflight-wp557-menace-signal.md` (scratchpad,
gitignored per `.claude/rules/work-packets.md §Invocation Artifacts`).
All five dependencies Active/Done on `main` @ `a426b67d`. Contract fidelity
verified against source, not WP prose. Seven risks (RS-1..RS-7) resolved and
locked.

**Empirical Scaffold: RUN, with an observed result.** Not strictly required
(this WP tightens no validation path), but run because AC-2's
behavior-identical claim must be observed rather than argued:

| | Observed |
|---|---|
| Baseline | `pnpm -r build` **0**; engine **2667 tests / 632 suites / 0 fail** |
| After the prototype extraction | **2667 / 0 — identical** ⇒ behavior-identical |
| Mutation control | reintroducing an object-index read of `SCHEME_TWIST_CONFIGS` produced **6 targeted failures** (Cosmic Cube 8-vs-fallback-7 + five suppression tests) |
| Scope impact | **zero** fixture breakage; nothing needed folding into scope |

The scaffold found one real defect at draft time: **`SCHEME_TWIST_CONFIGS` is
a `Map`, not a plain object** (`schemeTwistConfigs.ts:32`, consumed via
`.get()` at `schemeHandlers.ts:108`). Object-index access silently returns
`undefined` and collapses every denominator to the fallback `7`. Folded into
EC-592 §Locked Values + §Common Failure Smells before the pre-flight verdict
issued. The prototype was then discarded.

**Copilot check (`01.7`): PASS** (2 RISK findings, both FIXed in-place,
scope-neutral). Artifact: `docs/ai/invocations/copilot-wp557-menace-signal.md`.
All 30 issues scanned. Issue **5** (optional-field ambiguity) and issue **26**
(implicit content semantics) were remediated by writing the semantics into
D-24366 and §Contract — governance fixes, not scope changes — so no
pre-flight re-run was required.

## Lint Gate Self-Review

> `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — completed at draft.
> Recorded per section; `PASS` or `N/A` with justification.

| § | Verdict | Note |
|---|---|---|
| 1 Goal is user-visible | PASS | Infrastructure packet; goal states the consumer arc it unblocks. |
| 2 Scope closed | PASS | §Scope (In) is a closed 7-item enumeration; §Scope (Out) names arena-client, audio, `G`, configs, endgame. |
| 3 Assumes cite sources | PASS | Every line cites a D-entry or a file:line. |
| 4 Files allowlist | PASS | 11 files enumerated; ledgers excluded per `01.5`. |
| 5 Contract explicit | PASS | Type block + three locked rules (order, bands, `pile-depleted` fallback). |
| 6 AC testable | PASS | 12 ACs, each an observable assertion. |
| 7 Layer boundary | PASS | Engine-only. No registry import, no `apps/*` import, no `boardgame.io` in the new pure helper. |
| 8 Determinism | PASS | AC-10 pins both hash oracles; projection-only, no `ctx.random`. |
| 9 Persistence | PASS | No `G` field, nothing persisted, no snapshot change. |
| 10 Move contract | N/A | No move added or modified. |
| 11 Phase/turn | N/A | No `setPhase` / `endTurn` call. |
| 12 Zone ops | N/A | No zone mutation. |
| 13 Canonical arrays | PASS | `MENACE_TIERS` added **with** its union and a drift pin (§Scope In #1, #6; AC-6). |
| 14 Naming | PASS | Full English words; `schemeLossThreshold` mirrors the engine's existing `lossThreshold` vocabulary. `00.2` defines no competing name (grep clean). |
| 15 Error handling | PASS | No I/O. The `pile-depleted` and divide-by-zero paths are locked to defined values (AC-9). |
| 16 Test extension | PASS | AC-8 explicitly extends the drift pin rather than relying on the silently-passing existing one. |
| 17 Vision | PASS | §14 observability. No conflict; no monetization or PvP surface. |
| 18 Dependencies complete | PASS | D-24178 / D-24315 / D-24317 / WP-409 / WP-410 all landed and Active on `main` @ `a426b67d`. |
| 19 Lane eligibility | PASS | Two-session lane. Lightweight is **disqualified**: the `schemeHandlers.ts` extraction is a refactor of existing logic, not strictly additive (criterion 7). |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface touched. |
| 21 API catalog | N/A | No HTTP endpoint and no `Library-only` function reachable from `apps/server` added, changed, or removed. |

**All 21 sections resolved.** No unmet items.
