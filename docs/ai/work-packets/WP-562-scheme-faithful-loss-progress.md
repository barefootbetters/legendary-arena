# WP-562 — Scheme-Faithful Loss Progress (Game Engine + App)

**Status:** Drafted 2026-08-17
**EC:** [EC-597](../execution-checklists/EC-597-scheme-faithful-loss-progress.checklist.md)
**Reserves:** D-24371
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ WP-560 merge

---

## Goal

Make the danger meter measure what the active scheme actually loses on. Super
Hero Civil War's printed Evil Wins is *"If the Hero Deck runs out"*, but the
meter WP-558 shipped counts **Scheme Twists** — so a player watching the Hero
Deck drain from 42 to 11 sees a meter reading 3/7 twists. This packet makes
each scheme's meter track its own condition, restores the twist readout's
denominator, and fixes a solo threshold gap the same match exposed.

## Assumes

- **WP-557 / D-24366** — the menace projection. **This WP corrects its §5.**
- **WP-558 / D-24367** — the Danger Meter. Its §1 (information-not-decoration)
  and §2 (no client re-derivation) both stand unchanged.
- **D-24315** — `resourceLossCondition` suppresses the twist proxy.
- **D-24178** — the twist-threshold resolution order.
- **WP-410 / D-24222** — the precedent for a single cross-layer WP when the
  client provably cannot derive the data.

## Context

**Reported from a real match.** A Red Skull / Super Hero Civil War solo game
(`gitSha 8eb8b0c`) ended with the operator winning on turn 12. Its diagnostics
show `progress.menace: 0.4286` — exactly **3/7** — with `schemeLossProgress: 3`
and **no** `schemeLossThreshold`, while `decks.heroDeckCount` sat at **11**.
The meter was reporting twist progress for a scheme that cannot lose on twists.

**Root cause is D-24366 §5, which I wrote and which is wrong.** It reasoned
that a `pile-depleted` scheme has no denominator "because the pile's starting
size is not a scheme constant", and fell back to the twist proxy. The starting
size is not in the scheme *config* — but it is knowable at setup, where the
hero deck is built. "Not in the config" was conflated with "unknowable".

**Two further defects the same match exposed:**

1. **The twist readout lost its denominator.** WP-558 removed the hardcoded
   `/8` and rendered a bare count, because `schemeLossThreshold` is
   *resource*-typed for a `resourceLossCondition` scheme — reusing it would
   render `Twists: 3/12` for Negative Zone. The correct fix is a **separately
   projected twist threshold**, which this packet adds.
2. **Solo silently takes the arbitrary MVP fallback.** Civil War's
   `lossThresholdByPlayerCount` is `{2:8, 3:8, 4:5, 5:5}` — **no `'1'` key** —
   so a 1-player game falls through `lossThreshold` (absent) to
   `MVP_SCHEME_TWIST_THRESHOLD` (**7**). That is the 3/7 above. Solo mirrors
   2-player in Legendary, so `'1': 8` is the fix.

**Why cross-layer.** The client cannot derive a setup-time pile size — it sees
only the live projection. This is the WP-410 situation exactly, and the same
resolution: one WP that respects the boundary rather than a blocked pair.

**The engine projects a kind, never a label.** For the meter to say
"Heroes 11/42" for one scheme and "Escaped 4/12" for another, something must
know which noun applies. That is presentation, so the engine emits a
`schemeLossKind` **enum** and the client owns the words — keeping D-24367 §2's
no-re-derivation rule intact without leaking copy into the engine.

## Scope (In)

1. `setup/buildInitialGameState.ts` — capture the loss-pile's setup size into
   `G`, **lazily**: written only when the active scheme declares a
   `pile-depleted` condition. For `heroDeck` the captured value is
   `shuffledHeroDeck.length` — the **total hero cards built (42)**, before the
   5 are dealt to the HQ.
2. `rules/schemeLossProgress.ts` — per-condition numerator/denominator:
   - `pile-depleted` → numerator = `start - remaining` (depletion), denominator
     = the captured start.
   - `escaped-pile-count` / `escaped-converted-count` → unchanged.
   - twist-loss → unchanged.
   Plus a new `schemeLossKind` resolver and an exported twist-threshold
   accessor for the HUD.
3. `rules/schemeTwistConfigs.ts` — add the `'1'` player-count key to Super Hero
   Civil War (and any other config whose map omits solo).
4. `ui/uiState.types.ts` + `ui/uiState.build.ts` — project `schemeLossKind`
   and `schemeTwistThreshold` (both optional, always populated — the WP-410
   pattern).
5. `components/play/TopHudBar.vue` — restore `Twists: N/M` from
   `schemeTwistThreshold`.
6. `vfx/menaceDisplay.ts` + `components/play/DangerMeter.vue` — a kind-driven
   label and ratio.
7. Tests for every above surface; fixture backfill where the new optional
   fields are asserted.
8. `wiki/sound-effects.md` — correct the §The signal table, which currently
   documents the retired no-denominator behaviour.

## Scope (Out)

- Any change to D-24367 §1 (the meter still always renders) or §2 (no client
  re-derivation) — both stand.
- Any new scheme, twist resolver, or loss rule. This packet **reads** the
  existing conditions; it does not add one.
- The `:mastermind-tactics-total="4"` hardcode (still its own packet).
- Any audio change. WP-560's channel consumes `menaceTier`, whose meaning is
  unchanged — only its *inputs* become faithful.
- The `Surge of Power` misleading block message and the empty diagnostics
  `entries` buffer, both observed in the same match. Recorded in §Notes.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/setup/buildInitialGameState.ts` | lazily capture the loss-pile setup size |
| `packages/game-engine/src/rules/schemeLossProgress.ts` | per-condition numerator/denominator + `schemeLossKind` + twist-threshold accessor |
| `packages/game-engine/src/rules/schemeLossProgress.test.ts` | extend |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | add the `'1'` solo key |
| `packages/game-engine/src/types.ts` | the lazy `G` field |
| `packages/game-engine/src/ui/uiState.types.ts` | `schemeLossKind` + `schemeTwistThreshold` |
| `packages/game-engine/src/ui/uiState.build.ts` | populate both |
| `packages/game-engine/src/ui/uiState.build.progress.test.ts` | extend |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | extend the keyset pin |
| `packages/game-engine/src/index.ts` | export the new type |
| `apps/arena-client/src/vfx/menaceDisplay.ts` + `.test.ts` | kind-driven label |
| `apps/arena-client/src/components/play/DangerMeter.vue` + `.test.ts` | render the label |
| `apps/arena-client/src/components/play/TopHudBar.vue` + `.test.ts` | restore `Twists: N/M` |
| `apps/arena-client/src/fixtures/uiState/*.json` + `typed.ts` | backfill the new fields |
| `wiki/sound-effects.md` | correct the signal table |

## Contract

**Locked — loss progress measures the scheme's own condition (D-24371 §1).**

| Condition | Numerator | Denominator | `schemeLossKind` |
|---|---|---|---|
| `pile-depleted` (`heroDeck`) | cards drawn from the pool | total hero cards built | `hero-deck` |
| `pile-depleted` (`wounds`) | wounds taken from the stack | wound stack at setup | `wound-stack` |
| `escaped-pile-count` | matching escaped entries | condition threshold | `escaped-pile` |
| `escaped-converted-count` | matching converted entries | condition threshold | `escaped-converted` |
| none (true twist-loss) | twist count | twist threshold | `twists` |

**Locked — the hero-deck denominator is the TOTAL HERO CARDS BUILT (42)**, not
the post-HQ deck size (37). Operator decision, 2026-08-17: 42 is the number a
player counts on the table, and the 5 HQ cards are recruitable rather than
gone. The drafting recommendation was 37 (the literal runway to
`heroDeck.length === 0`); it was **overruled deliberately**, and this note
exists so a future reader does not "correct" it back.

**Locked — the `G` field is lazy.** Written only for a `pile-depleted` scheme,
so a match on any other scheme carries no new field.

> **Determinism — a re-pin IS expected here.** The sentinel fixture
> `sentinel-core-doom-2p` uses **`core/legacy-virus-the`**, which *is* a
> `pile-depleted` scheme (wounds). The lazy field therefore **does** appear in
> that fixture and **will** move `finalStateHash`. This is a real, reasoned
> re-pin: re-record via the canonical recorder, never hand-edit.
> `PRE_WP080_HASH` (the empty replay, no scheme) is expected **unchanged** —
> verify rather than assume.

**Locked — enum not label.** The engine emits `schemeLossKind`; every
player-facing noun lives in `menaceDisplay.ts`.

## Acceptance Criteria

- **AC-1** — a Civil War game projects `schemeLossKind: 'hero-deck'`, a
  denominator equal to the total hero cards built, and a numerator that rises
  as the deck drains. With 42 built and 11 left: `31/42`, menace `≈ 0.738`.
- **AC-2** — the HUD renders **`Heroes 11/42`** for that state, not a twist count.
- **AC-3** — Legacy Virus projects `schemeLossKind: 'wound-stack'` against the
  wound stack at setup.
- **AC-4** — an `escaped-pile-count` scheme (Negative Zone) is **unchanged**:
  numerator = matching escaped entries, denominator = 12.
- **AC-5** — a true twist-loss scheme (Portals) projects `'twists'` with the
  twist threshold.
- **AC-6** — `Twists: N/M` renders from `schemeTwistThreshold`, and for Negative
  Zone that M is the **twist** threshold (8), never the resource threshold (12).
- **AC-7** — **solo Civil War resolves to 8**, not the MVP fallback 7. A
  regression test pins `'1'` in the player-count map.
- **AC-8** — the `G` field is absent for a non-`pile-depleted` scheme.
- **AC-9** — determinism: `PRE_WP080_HASH` **unchanged**; the sentinel
  `finalStateHash` **re-recorded via the canonical recorder**, with the old and
  new values both stated in the governance close.
- **AC-10** — no client re-derivation: given `schemeLossKind: 'hero-deck'` with
  a deliberately inconsistent `menaceTier: 'calm'`, the meter renders **calm**
  (D-24367 §2 still holds).
- **AC-11** — `pnpm -r build` 0; engine + arena-client suites green;
  `arena-client typecheck` 0; `pnpm -r --no-bail test` no new failures.
- **AC-12** — **D-24026**: a live Civil War match shows `Heroes N/42` tracking
  the deck and `Twists: N/8`.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; `pnpm --filter arena-client typecheck` → 0.
3. `pnpm -r --no-bail test` → no new failures.
4. Confirm `PRE_WP080_HASH` unchanged; re-record the sentinel and state both
   hash values.
5. Wiki link-check.
6. Post-deploy: AC-12.

## Definition of Done

- [x] AC-1..AC-11 demonstrated with observed output; AC-12 verified or
      recorded operator-pending.
- [x] D-24371 landed **Active**, including the 42-over-37 operator decision.
- [x] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [x] `STATUS.md` records the re-pin explicitly (old → new hash).
- [x] D-24366 §5 marked **superseded** by D-24371 in `DECISIONS.md`.

## Notes

Two defects observed in the same match, deliberately **not** fixed here:

1. **`Surge of Power`'s block message is wrong.** It logs *"a play condition
   (such as Hero class or team synergy) was not met"* when the real gate is
   "8+ recruit this turn". The condition works; the message misattributes it
   and would misdirect anyone debugging. Its own packet — the message
   machinery is shared across every conditional hero ability.
2. **The diagnostics `entries` buffer is empty** for a full 12-turn match
   (`entryCount: 0`, nothing dropped, not truncated). Either tracing is off by
   default or the capture is broken; that is a diagnostics-surface packet, not
   this one.
