# WP-316 — Villain-Deck Effect Narration in the Play-by-Play Log (Fight / Ambush / Escape, with Per-Target Results)

## Goal

When a villain-deck card resolves an effect — a **Fight:** effect on
defeat, an **Ambush:** effect on City entry, or an **Escape:** effect on
the escape edge — the persistent play-by-play log (the quiet log panel
on `play.legendary-arena.com`) narrates **what the effect did, including
the specific targets** — e.g. `Fight effect: the active player KO'd
Spider-Man from their discard; Iron Man was captured from the HQ.` — not
just that a card was fought/revealed. This widens the engine's
villain-effect executor to report **per-effect results** (the KO'd
hero(es), the captured HQ hero, the escaped card, the affected players),
resolves those ext_ids to display names, and writes an effect-narration
line into `G.messages` (projected verbatim to `UIState.log`) at all
three fire sites.

## Assumes

- **WP-185 / WP-186 / WP-200** ✅ — `executeVillainAbilities(...,
  timing)` applies the villain-effect vocabulary for `onFight` /
  `onAmbush` / `onEscape` and returns the applied `VillainEffectKeyword[]`
  in dispatch order. The executor is **timing-agnostic** — one return
  path serves all three sites.
- **WP-200** ✅ — `composeFightNarrative` / `composeAmbushNarrative` +
  the private `EFFECT_KEYWORD_LABELS` / `joinEffectLabels` /
  `labelForEffect` helpers produce byte-stable phrases. There is **no**
  `escapeResolved` notableEvent and **no** `composeEscapeNarrative`
  today — the Escape site (`villainDeck.reveal.ts:245`) fires effects
  and ignores the return.
- **UIState log projection** ✅ — `buildUIState` projects
  `UIState.log = [...gameState.messages]` verbatim (`uiState.build.ts:681`).
- **WP-294 / D-24081** ✅ — `G.messages` is **excluded** from
  `finalStateHash`; `G.notableEvents` is **included**.
- **`captureHeroFromHq`** ✅ returns `CaptureHeroResult | null`; the KO
  resolvers (`koOneHeroForPlayer` / `koSingleTarget`) are internal to
  `villainEffects.execute.ts` and know their target at selection
  (`selectKoHeroTarget`, deterministic per D-20602).
- Baseline: `origin/main` @ `c0870651`.

## Context

Operator report: "defeat a villain with a Fight: effect → the message
should display **it and the results**," extended (this WP) to the villain
deck's sibling effect timings: **Ambush** (a villain's effect when it
enters the City) and **Escape** (its effect when pushed off the escape
edge). Both share the exact Fight machinery — the same executor, the same
result-aware composer — so covering all three gives the villain-deck log
a complete account of what each card did, at per-target granularity, for
one executor refactor.

Today: `fightVillain.ts` and the Ambush site both compose their narrative
only into the transient `notableEvents` overlay (at keyword-label
granularity — never naming *which* hero); the durable log gets only terse
`fought`/`rescued`/reveal lines. The Escape site narrates nothing at all.

**Mastermind tactics are explicitly NOT in scope** and cannot ride this
contract: `fightMastermind.ts` uses a separate subsystem
(`defeatTopTactic`) and the code notes "tactic text effects are WP-024" —
i.e. tactic effects are not implemented yet, so there is nothing to
narrate. See `§Scope (Out)`.

**Why this is a contract change (standard two-session lane, D-24028).**
The executor's return widens from `VillainEffectKeyword[]` to a new
`VillainEffectResult[]` so each applied effect carries its targets. That
touches `villainAbility.types.ts` (a contracts file) + every call site
(`fightVillain.ts`; the Ambush + Escape sites in `villainDeck.reveal.ts`).
Engine-only; preserves the replay hash + arena-client by the byte-identity
guarantee below.

**The byte-identity guarantee (keeps hash + client unchanged).** The two
existing hash-bearing events (`fightResolved`, `ambushResolved`) keep
their `appliedEffects: VillainEffectKeyword[]` field and their
`composeFightNarrative` / `composeAmbushNarrative` string **byte-identical
to `main`**, by mapping `results.map((result) => result.keyword)` at each
site. **No new notableEvent is added** — in particular the Escape site
gets a **log line only, not an `escapeResolved` event** — so
`G.notableEvents` (hashed + projected to the client) is unchanged for
every timing. `finalStateHash` needs no re-pin; the arena-client is
untouched. The richer per-target data feeds **only** the hash-excluded
`G.messages` log lines.

## Scope (In)

- **Widen the executor result contract.** Add `VillainEffectResult` to
  `villainAbility.types.ts`:
  `{ keyword: VillainEffectKeyword; targets: CardExtId[]; pending?: boolean }`.
  `targets` holds the affected card ext_ids (KO'd hero(es), captured HQ
  hero, escaped card); `pending: true` marks a parked interactive KO
  (≥2-eligible current-player KO — no hero KO'd yet at this fire site).
  `executeVillainAbilities` returns `VillainEffectResult[]` for **all**
  timings.
- **Report results from each handler** (`villainEffects.execute.ts`): the
  internal `VillainEffectHandler` returns a `VillainEffectResult` payload;
  `koOneHeroForPlayer` / `koSingleTarget` return the KO'd ext_id;
  `capture-hq-hero` reads the `captureHeroFromHq` return;
  `hero-deck-top-to-escape` reports the moved card; `gain-wound` /
  `capture-bystander` report `targets: []` (generic-label granularity).
  The current-player ≥2-eligible KO reports `pending: true`.
- **Map to keywords at both existing notableEvent sites**
  (`fightVillain.ts` `fightResolved`; `villainDeck.reveal.ts`
  `ambushResolved`) so `appliedEffects` + the composed narrative are
  byte-identical to `main`.
- **New result-aware pure composer** in `notableEvents.compose.ts` that
  formats an effect-result list (with pre-resolved target names) into a
  log line; reuses the existing label vocabulary for the no-target
  effects (wounds/bystanders).
- **Narrate into the log at all three fire sites:**
  - **Fight** (`fightVillain.ts`) — resolve `targets` → names via
    `G.cardDisplayData[extId]?.name` (ext_id fallback), push one
    `Fight effect: …` line when ≥1 effect applied.
  - **Ambush** (`villainDeck.reveal.ts`) — same, push one `Ambush
    effect: …` line (in addition to the unchanged `ambushResolved`
    overlay event).
  - **Escape** (`villainDeck.reveal.ts`) — capture the previously-ignored
    return, resolve names, push one `Escape effect: …` line. **No new
    notableEvent** (log only — preserves the hash).
- Name resolution is shared across the three sites (duplicate-first →
  extract a small `G.cardDisplayData` name-resolution helper if a third
  identical copy appears); the composer stays pure (receives resolved
  names).
- Tests across all touched files, including a hash-stability assertion
  (every notableEvent + narrative byte-identical; no new event) and
  per-target golden log strings for each timing.

## Scope (Out)

- **Mastermind tactics / Master Strike narration** (`fightMastermind.ts`,
  the mastermind subsystem). Different execution path and vocabulary (not
  `VillainEffectKeyword` / `executeVillainAbilities`), and tactic text
  effects are **not implemented** (deferred to WP-024). Blocked; its own
  future WP after WP-024. `composeMastermindDefeatedNarrative` /
  `composeMastermindStrikeNarrative` unchanged.
- **Resolve-time narration of the parked interactive KO.** A ≥2-eligible
  current-player KO logs "the active player must KO a hero (choice
  pending)" at fire time; naming the hero the player actually picks
  happens later in `resolveKoHeroChoice` and is a follow-up (this WP does
  not touch the pending-choice resolution path).
- **Any new notableEvent** (no `escapeResolved`) and **any change to the
  `fightResolved` / `ambushResolved` event shape,
  `composeFightNarrative` / `composeAmbushNarrative` output, the
  `VillainEffectKeyword` union, or the descriptor pipeline.** Overlay +
  hash + client surfaces are frozen.
- **Rewriting the existing terse fought/rescued/reveal log lines.**
  Cosmetic; kept out to bound churn.

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — add
  `VillainEffectResult` interface (contracts file; D-24102).
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — type
  coverage for the new interface (if warranted).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — handler
  signature returns results; resolvers return KO'd ext_id; executor
  returns `VillainEffectResult[]`.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` —
  per-handler result assertions (targets, pending, no-op empties).
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — Ambush
  site maps `results→keywords` (byte-identical event + narrative) + adds
  an `Ambush effect: …` log line; Escape site captures the return + adds
  an `Escape effect: …` log line (no new notableEvent).
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` —
  Ambush byte-identity + Ambush/Escape log assertions; assert no new
  notableEvent on Escape.
- `packages/game-engine/src/moves/fightVillain.ts` — map for the
  `fightResolved` event (byte-identical); resolve target names; push the
  result-aware `Fight effect: …` log line.
- `packages/game-engine/src/moves/fightVillain.test.ts` — per-target log
  assertions; hash/event byte-identity; count-assertion adjustments.
- `packages/game-engine/src/events/notableEvents.compose.ts` — new
  result-aware pure log composer.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` —
  golden strings (per-target, pending, no-target, multi-effect).
- Governance: `docs/ai/DECISIONS.md` (D-24102), `WORK_INDEX.md`
  (WP-316 → `[x]`), `EC_INDEX.md` (EC-346 → Done), `STATUS.md`.

## Contract

- **New type** (`villainAbility.types.ts`): `VillainEffectResult =
  { keyword: VillainEffectKeyword; targets: CardExtId[]; pending?: boolean }`.
  Additive; the `VillainEffectKeyword` union and descriptor types are
  unchanged.
- **Executor return** (`villainEffects.execute.ts`):
  `executeVillainAbilities(...): VillainEffectResult[]` for all timings.
  Dispatch order unchanged; out-of-vocab still excluded.
- **Byte-identity invariant:** for every `NotableGameEvent`
  (`fightResolved`, `ambushResolved`), `appliedEffects === results.map((r)
  => r.keyword)` and the composed narrative are byte-identical to `main`;
  **no new notableEvent type** is introduced. `finalStateHash` unchanged;
  arena-client untouched.
- **Log-line contract:** one additional `G.messages` entry per fire site
  per event, emitted iff ≥1 effect applied — `Fight effect: …` (fight),
  `Ambush effect: …` (ambush), `Escape effect: …` (escape) — after that
  site's existing pushes, and (Fight/Ambush) before the notableEvents
  push. Target names resolved via `G.cardDisplayData` with ext_id
  fallback; the composer is pure.
- **No contract change beyond `VillainEffectResult`.**

## Acceptance Criteria

- [ ] `executeVillainAbilities` returns `VillainEffectResult[]` for all
      three timings; `targets` names the affected card ext_id(s): auto-KO
      → the KO'd hero; capture-hq → the captured hero; hero-deck-escape →
      the escaped card; gain-wound / capture-bystander → `[]`.
- [ ] A ≥2-eligible current-player KO reports `pending: true`, `targets:
      []`.
- [ ] A no-op effect (empty pile / empty HQ / no eligible hero) reports
      `targets: []`.
- [ ] Defeating a Fight:-effect villain, revealing an Ambush:-effect
      villain, and escaping an Escape:-effect villain each push one
      `Fight effect:` / `Ambush effect:` / `Escape effect:` log line that
      names the resolved target(s) (or "must KO a hero" for pending, or
      the generic label for wounds/bystanders), appearing verbatim in
      `UIState.log`.
- [ ] An effectless fight/ambush/escape pushes no effect line; a
      blocked/no-op fight pushes no messages (existing behaviour).
- [ ] **Byte-identity:** every `fightResolved` / `ambushResolved` event's
      `appliedEffects` and composed narrative are byte-identical to
      `main`; **no `escapeResolved` (or any new) notableEvent** is added;
      the bot-vs-bot sweep `finalStateHash` is **unchanged**.
- [ ] `pnpm --filter @legendary-arena/game-engine test` + `build` green;
      `pnpm -r build` 0.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — executor result
   tests, Ambush byte-identity, Fight/Ambush/Escape per-target log tests,
   composer goldens all pass; full engine suite green.
2. Bot-vs-bot sweep / fixture replay → sentinel `finalStateHash`
   **unchanged** vs. `main`.
3. `pnpm -r build` → 0.
4. **D-24026 live-verify (operator, post-deploy):** defeat / reveal-ambush
   / escape a villain with a KO or HQ-capture effect and confirm the log
   panel names the specific hero for each timing.

## Definition of Done

- [ ] All Acceptance Criteria satisfied; `finalStateHash` unchanged.
- [ ] Engine suite + `pnpm -r build` green.
- [ ] `git diff --name-only` matches the `§Files Expected to Change`
      allowlist (engine-only; no client/server/registry).
- [ ] D-24102 landed **Active**; WORK_INDEX WP-316 `[x]`; EC_INDEX EC-346
      Done; STATUS updated.
- [ ] `User-Visible Surface = play.legendary-arena.com` (log panel) →
      D-24026 live-verify recorded operator-pending on deploy.

## §17 Vision Alignment

Vision §3 (engine owns truth — read-side reporting; byte-identity → no
rule/outcome change), §14 (observability / the game explains itself), §22
(determinism — notableEvents byte-identical + no new event, `G.messages`
hash-excluded, pure byte-stable composer). No conflict; NG-1..7 not
crossed.

## §21 API Catalog

N/A — no `apps/server` HTTP endpoint and no `Library-only` server-import
surface touched.

## Lint Gate Self-Review (00.3 — 21 sections)

1. **Scope closed** — PASS (§Scope In/Out enumerated; single layer; three
   fire sites, one executor).
2. **Layer boundary** — PASS (Game Engine only; composer imports no
   framework/registry; no cross-layer edge).
3. **Dependencies real & complete** — PASS (WP-185/186/200/294 Done;
   `captureHeroFromHq` return + internal KO resolvers + the timing-agnostic
   executor verified on `main`).
4. **Determinism** — PASS (notableEvents byte-identical + no new event →
   `finalStateHash` unchanged; `G.messages` hash-excluded D-24081; pure
   composer; KO target selection deterministic D-20602).
5. **Persistence boundary** — PASS (no snapshot/DB; `G.messages`
   runtime-only, already projected).
6. **Contract files** — CONDITIONAL PASS (one additive interface
   `VillainEffectResult`; authorized via D-24102; no `.validate/.gating`,
   no existing field changed).
7. **Canonical arrays / union drift** — PASS (`VillainEffectKeyword`,
   primitives, timings unchanged; no drift array edited).
8. **Move validation contract** — PASS (no new move; Fight push in the
   existing post-mutation step; move returns `void`, never throws; Ambush/
   Escape are non-move reveal-flow sites).
9. **Naming** — PASS (`VillainEffectResult`, `composeEffectResultLogLine`,
   `appliedFightResults` / `appliedAmbushResults` / `appliedEscapeResults`).
10. **`.reduce()` ban** — PASS (`for...of` / `.map(r=>r.keyword)` only).
11. **`// why:` comments** — PASS (byte-identity map at each event site;
    Escape-is-log-only-no-event; length-guarded pushes; name-resolution-in-
    site-not-composer; pending-KO).
12. **Error handling** — PASS (composer total; missing name → ext_id
    fallback; empty results → no line; no I/O, no throw).
13. **Test extension** — PASS (`.test.ts`; `node:test`; `makeMockCtx`).
14. **Files match allowlist** — PASS (§Files ↔ EC-346 §Files to Produce).
15. **No invented mechanics** — PASS (reports existing mutations; no new
    effect/phase/counter/keyword).
16. **Duplicate-first** — PASS (result composer beside existing composers;
    name-resolution helper extracted only at the 3rd identical site).
17. **Vision gate** — PASS (§17 block present).
18. **Commit hygiene** — PASS (EC-346:/SPEC: prefixes).
19. **Move-registration drift test** — N/A (no move added).
20. **Card-data-derived `:check` gates** — N/A (no data/keyword/coverage
    change).
21. **API catalog (D-11804)** — N/A (no HTTP / server-import surface).

**Verdict: 21/21 resolved (17 PASS incl. 1 conditional, 4 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Dependencies verified on `main` (WP-185/186/200/294;
timing-agnostic executor; `captureHeroFromHq` return; internal KO
resolvers; no `escapeResolved` event exists today; UIState log
projection; D-24081 hash exclusion). Scope locked and single-layer across
three fire sites. The byte-identity guarantee (map results→keywords at
both existing events; add no new event) is load-bearing and testable
(sweep `finalStateHash` + per-event narrative equality + a "no new
notableEvent type" assertion). Not a validation-tightening WP. Standard
two-session lane (contract widen + multi-site refactor). No blocking
PS-items.

## Copilot Check Verdict (01.7)

**PASS.** The one real risk — a return-type widening (or an Escape
narrative) silently perturbing the replay hash or the client — is fenced
by the explicit byte-identity invariant (map at both events; **no new
notableEvent**, Escape is log-only), a `finalStateHash`-unchanged
acceptance gate, and an Ambush byte-identity + no-new-event test. No
layer crossing, no monetization/identity/RNG, no new `VillainEffectKeyword`.
Contract-file touch is a single additive interface with a reserved D-entry.
Mastermind exclusion is correct (separate subsystem, blocked on WP-024).
No BLOCK modes; executor-refactor size is the noted RISK, mitigated by the
standard-lane split.
