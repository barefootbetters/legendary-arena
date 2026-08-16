# WP-558 — Danger Meter on the Play Surface (App)

**Status:** Drafted 2026-08-16
**EC:** [EC-593](../execution-checklists/EC-593-danger-meter-hud-play-surface.checklist.md)
**Reserves:** D-24367
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 live verification REQUIRED**
**Drafted off:** `origin/main` @ `879416c5`

---

## Goal

Show the player how close the villains are to winning. A **Danger Meter** in
the shared play HUD renders WP-557's projected `menace` scalar as a filling
bar with a tier treatment, so the pressure the engine already tracks becomes
something a player can feel at a glance instead of inferring from a twist
count. The same change **fixes a wrong number that ships in every match
today**: the twist readout's hardcoded `/8` denominator is replaced with the
active scheme's real one.

## Assumes

- **WP-557 / D-24366** — `UIState.progress` carries `menace`, `menaceTier`,
  `schemeLossProgress`, `schemeLossThreshold`. Landed on `main` @ `879416c5`.
- **WP-556 / D-24365** — `vfx/effectIntensity.ts` provides the persisted
  Effect-Intensity control and day-one `prefers-reduced-motion`, via
  `useEffectIntensity()`.
- **D-24315 / D-24317 / D-24178** — the loss rules the projected threshold
  already encodes. This packet consumes the result and re-derives none of it.
- `TopHudBar.vue` is rendered by **both** `PlayDesktop.vue` and
  `PlayMobile.vue`, so one host covers both surfaces.
- `PlayViewport` is the live play root (`App.vue` `route === 'live'`).

## Context

**Why now.** WP-557 shipped the signal and deliberately shipped no consumer,
so nothing on the play surface changed. This is the packet that makes it
visible — and it is the packet that finally closes a defect that has been
live in every match.

**The defect.** `PlayDesktop.vue:530` and `PlayMobile.vue:360` each pass a
literal `:scheme-twist-threshold="8"` into `TopHudBar`, which renders
`Twists: {{ twistCount }}/8`. That denominator is wrong three ways: the
unconfigured-scheme fallback is **7** (`MVP_SCHEME_TWIST_THRESHOLD`), Super
Hero Civil War is 8 at 2–3 players but **5** at 4–5, and any scheme declaring
a `resourceLossCondition` does not lose on twist count at all. The prop is
removed and `UIState.progress.schemeLossThreshold` used instead.

**Why the meter is not just decoration.** The obvious implementation routes
the meter through WP-556's Effect-Intensity gate alongside the confetti and
the screen shake. That would be wrong: a player who turns effects off to
reduce motion would lose access to live loss-progress — real game state, not
polish. **D-24367 §1** locks the split — the meter and its numbers always
render; only its *animation* (the critical-tier pulse, the width/colour
transition) is gated by Effect-Intensity and `prefers-reduced-motion`. The
`VfxKind` union (`shake` / `particles` / `word`) is deliberately **not**
extended, because the readout is not a VFX kind.

**Empirical scaffold — run at draft (see §Gate Verdicts).** A grep suggested
four affected references; an actual prototype run showed only **one** test
assertion breaks, and surfaced something grep could not: the three
hand-written `fixtures/uiState/*.json` carry **no** menace fields, so the
`?fixture=mid-turn&play=1` dev-preview route would render an empty meter and
look broken. Backfilling those fixtures is therefore in scope, and the
component must degrade gracefully regardless — a recorded replay or an older
snapshot can legitimately lack the fields.

**Why one WP.** The meter and the `/8` fix touch the same component and the
same projected data; splitting them would ship a corrected denominator with
no meter, or a meter beside a wrong number. The adaptive music channel
(packet 3) stays separate — different channel, different concerns.

## Scope (In)

1. `components/play/DangerMeter.vue` — the meter: a filling bar keyed to
   `menace`, a tier treatment keyed to `menaceTier`, and accessible text.
2. `vfx/menaceDisplay.ts` — a **pure**, unit-tested module deriving the
   bar percentage, the tier CSS class, the label, and the ARIA text. No Vue
   import, so the logic is testable without mounting.
3. `components/play/TopHudBar.vue` — hosts the meter; **removes** the
   `schemeTwistThreshold` prop; reads the projected fields.
4. `pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — drop the hardcoded
   `:scheme-twist-threshold="8"`.
5. `components/play/TopHudBar.test.ts` — migrate the one breaking assertion
   and remove the three now-inert `schemeTwistThreshold: 8` mount props.
6. `fixtures/uiState/{mid-turn,endgame-win,endgame-loss}.json` — backfill the
   four menace fields so the dev-preview route exercises the meter.
7. `wiki/visual-effects.md` — the "Ambient menace layer" bullet still lists
   this as out-of-scope-for-v1 and still describes the `escapedVillains` /
   `twistCount` formula retired by **D-24317**. Corrected in lockstep.

## Scope (Out)

- **Any `packages/**` file.** This is client-only; the engine is untouched.
- **Any audio.** The adaptive music channel is packet 3.
- Any re-derivation of a loss threshold client-side — forbidden; that is
  precisely what WP-557 centralised.
- Any change to `VfxKind` or the Effect-Intensity contract.
- The `:mastermind-tactics-total="4"` prop — also hardcoded, but it is the
  mastermind tactic count, a separate concern. Flagged in §Notes, not fixed.
- Any new `UIState` field, endpoint, or dependency.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/arena-client/src/components/play/DangerMeter.vue` | **new** |
| `apps/arena-client/src/components/play/DangerMeter.test.ts` | **new** |
| `apps/arena-client/src/vfx/menaceDisplay.ts` | **new** — pure derivation |
| `apps/arena-client/src/vfx/menaceDisplay.test.ts` | **new** |
| `apps/arena-client/src/components/play/TopHudBar.vue` | host meter; drop prop |
| `apps/arena-client/src/components/play/TopHudBar.test.ts` | migrate 1 assertion; drop 3 inert props |
| `apps/arena-client/src/pages/PlayDesktop.vue` | drop hardcoded prop |
| `apps/arena-client/src/pages/PlayMobile.vue` | drop hardcoded prop |
| `apps/arena-client/src/fixtures/uiState/mid-turn.json` | backfill menace fields |
| `apps/arena-client/src/fixtures/uiState/endgame-win.json` | backfill menace fields |
| `apps/arena-client/src/fixtures/uiState/endgame-loss.json` | backfill menace fields |
| `wiki/visual-effects.md` | correct the ambient-menace bullet |

Governance ledgers excluded per `01.5`.

## Contract

**Locked — the meter always renders (D-24367 §1).** Presence and numbers are
never gated. Only these are gated by `useEffectIntensity()`:

| Aspect | Gated? |
|---|---|
| The bar, its fill, the tier colour, the text | **No** — always rendered |
| The critical-tier pulse animation | Yes — suppressed at `off`/`low` and under `prefers-reduced-motion` |
| The width / colour CSS transition | Yes — suppressed under `prefers-reduced-motion` |

**Locked — no client-side re-derivation (D-24367 §2).** The component reads
`menace`, `menaceTier`, `schemeLossProgress`, `schemeLossThreshold` and
computes nothing beyond presentation (a percentage and a class name). It
never re-bands a tier and never resolves a threshold.

**Locked — no-denominator rendering (D-24367 §4).** When
`schemeLossThreshold` is absent (a `pile-depleted` scheme, D-24366 §5), the
twist readout shows the bare progress count with **no** ratio, and the meter
renders from `menace` alone. It must never default to `8`, `7`, or any other
invented denominator.

**Locked — absent-signal degradation.** When `menace` itself is absent (an
old fixture, a recorded replay), the meter renders **nothing** rather than a
zero-width "safe" bar — an absent signal is not the same claim as "no
danger", and a false calm is worse than no meter.

## Acceptance Criteria

- **AC-1** — `menaceDisplay.ts` is pure (no Vue import) and unit-tested:
  percentage, tier class, label, and ARIA text for each tier.
- **AC-2** — the twist readout renders the **projected** threshold. With a
  scheme whose threshold is 5, it renders `5` — not `8`.
- **AC-3** — with `schemeLossThreshold` absent, the readout shows the bare
  count and no `/`, and nothing renders `8` or `7`.
- **AC-4** — with `menace` absent entirely, the meter does not render.
- **AC-5** — the meter renders at every Effect-Intensity setting including
  `off`, and under `prefers-reduced-motion` — only the pulse/transition
  classes drop. Asserted at `off` **and** `full`.
- **AC-6** — `menaceTier` drives the tier treatment, and the component does
  **not** re-band: given a deliberately inconsistent pair (`menace: 0.9`,
  `menaceTier: 'calm'`) it renders the **calm** treatment, proving the tier
  comes from the projection.
- **AC-7** — the `schemeTwistThreshold` prop is gone from `TopHudBar.vue`
  **and** from both parents; a grep for `scheme-twist-threshold` across
  `apps/arena-client/src` returns zero matches.
- **AC-8** — the three UIState fixtures carry the four menace fields, and the
  `?fixture=mid-turn&play=1` dev route renders a populated meter.
- **AC-9** — `pnpm --filter arena-client typecheck` exits 0 and the suite is
  green: baseline **1279 / 184 / 0** → up by the new tests, with the one
  migrated assertion passing.
- **AC-10** — zero `packages/**` files in the diff
  (`git diff --name-only -- packages` is empty); no runtime `registry` /
  `server` import; no `G`/`ctx` write.
- **AC-11** — `wiki/visual-effects.md` no longer describes the ambient menace
  layer as driven by `escapedVillains` / `twistCount`, and no longer lists it
  as out-of-scope-for-v1; wiki link-check passes.
- **AC-12** — **D-24026 live verification**: on the deployed bundle, open a
  real match and confirm (a) the meter renders and tracks as twists resolve,
  and (b) the twist denominator matches the active scheme rather than `8`.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter arena-client typecheck` → 0 (**load-bearing**: `vite build`
   is esbuild and `node:test` runs under tsx — neither typechecks SFCs).
3. `pnpm --filter arena-client test` → green, count up by the new tests.
4. `pnpm -r --no-bail test` → no new failures.
5. `git diff --name-only -- packages` → empty.
6. `grep -rn "scheme-twist-threshold" apps/arena-client/src` → no matches.
7. Dev preview `?fixture=mid-turn&play=1` → meter renders populated.
8. Wiki link-check → passes.
9. Post-deploy: AC-12 on `play.legendary-arena.com`.

## Definition of Done

- [ ] AC-1..AC-11 demonstrated with observed output.
- [ ] AC-12 (D-24026) verified live, or explicitly recorded as
      operator-pending on the deploy in `STATUS.md`.
- [ ] `pnpm -r build` 0; arena-client typecheck 0; suite green;
      `pnpm -r --no-bail test` no new failures.
- [ ] D-24367 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅` and
      `pnpm roadmap:counts:check` 0.
- [ ] `STATUS.md` updated.
- [ ] Packet 3 (adaptive music) named as the remaining consumer.

## Gate Verdicts (Drafting Session, 2026-08-16)

**Pre-flight (`01.4`): READY TO EXECUTE.** Artifact:
`docs/ai/invocations/preflight-wp558-danger-meter.md`. Both hard-deps
(WP-557 ✅, WP-556 ✅) are Active on `main` @ `879416c5`.

**Empirical Scaffold: RUN — REQUIRED for this WP class** (it removes a
required prop, i.e. tightens an existing input path):

| | Observed |
|---|---|
| Baseline | arena-client **1279 tests / 184 suites / 0 fail**, typecheck **0** |
| Prototype | removed the prop from `TopHudBar.vue` + both parents; read the projected threshold |
| Result | **1279 / 1 fail** — a single assertion, `TopHudBar.test.ts` "renders twist + mastermind…": `'Twists: 2'` vs expected `'Twists: 2/8'` |
| Typecheck under prototype | **still 0** |

Two findings grep alone would have missed:

1. Grep showed **four** `schemeTwistThreshold` references, but only **one**
   is load-bearing. The other three are mount props in tests that Vue simply
   ignores once the prop is undeclared — inert, but cleaned up in scope so
   they do not mislead the next reader.
2. The prototype rendered `Twists: 2` (no denominator) because the
   **hand-written UIState fixtures carry no menace fields at all**. Left
   alone, the dev-preview route would show an empty meter and read as a bug.
   Fixture backfill was folded into `§Scope (In)` #6 and the allowlist as a
   result, and the absent-signal degradation rule was added to `§Contract`.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Artifact:
`docs/ai/invocations/copilot-wp558-danger-meter.md`. Issue **9** (UI
re-implements engine logic) was the live risk on a WP whose whole job is
rendering an engine-derived number; FIXed by locking D-24367 §2 (no
re-derivation) and adding **AC-6**, which proves non-re-banding with a
deliberately inconsistent `menace`/`menaceTier` pair rather than asserting
it in prose.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | PASS | `play.legendary-arena.com`; D-24026 required (AC-12). |
| 2 Scope closed | PASS | 7-item In; Out names `packages/**`, audio, re-derivation, `VfxKind`, the tactics prop. |
| 3 Assumes cite sources | PASS | Each cites a WP or D-entry landed on `main`. |
| 4 Files allowlist | PASS | 12 files; scaffold-corrected (fixtures folded in). |
| 5 Contract explicit | PASS | Four locked rules incl. the gating table. |
| 6 AC testable | PASS | 12 ACs, each observable. |
| 7 Layer boundary | PASS | App-only; no runtime `registry`/`server` import; AC-10 pins an empty `packages` diff. |
| 8 Determinism | PASS | Pure presentation; reads projection only; hash-excluded, no `G` write. |
| 9 Persistence | N/A | Nothing persisted (the intensity setting is WP-556's, unchanged). |
| 10 Move contract | N/A | No move. |
| 11 Phase/turn | N/A | No transition. |
| 12 Zone ops | N/A | No zone mutation. |
| 13 Canonical arrays | N/A | Consumes `MenaceTier`; adds no array and re-bands nothing. |
| 14 Naming | PASS | Field names read verbatim from `UIProgressCounters`. |
| 15 Error handling | PASS | Absent-signal and absent-denominator paths both locked (AC-3, AC-4). |
| 16 Test extension | PASS | The migrated assertion is corrected, not deleted; AC-6 is an anti-re-derivation gate. |
| 17 Vision | PASS | §14 observability, §11 read-only. Retention polish; no pay-to-win, no PvP terminology. |
| 18 Dependencies complete | PASS | WP-557 ✅, WP-556 ✅ both on `main` @ `879416c5`. |
| 19 Lane eligibility | PASS | Two-session. Lightweight disqualified: 12 files (> 4) and it removes a required prop (not strictly additive). |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No HTTP endpoint added, changed, or removed. |

**All 21 sections resolved.**

## Notes

`:mastermind-tactics-total="4"` is hardcoded in both parents by the same
pattern that produced the `/8` defect. It is left alone here because the
mastermind tactic count is a different quantity with no projected
equivalent — closing it would need an engine-side projection first, i.e. its
own WP. Recorded so the next reader knows it was seen, not missed.
