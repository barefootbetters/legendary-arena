# EC-346 — Villain-Deck Effect Narration in the Play-by-Play Log (Fight / Ambush / Escape, Per-Target Results) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-316-villain-fight-effect-log-narration.md
**Layer:** Game Engine only (rules/villain/villainDeck/moves/events; no client/server/registry change)
**Lane:** Standard two-session (D-24028 — contract widen + multi-fire-site executor refactor)

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `c0870651` recorded.
- [ ] Fresh worktree → `pnpm -r build` BEFORE the suite (registry consumers read `dist`).
- [ ] Capture the sweep/fixture `finalStateHash` on `main` FIRST — must be byte-identical after.
- [ ] Verify on `main`: `executeVillainAbilities` returns `VillainEffectKeyword[]` and is timing-agnostic
      (Fight `fightVillain.ts`, Ambush `villainDeck.reveal.ts:269`, Escape `villainDeck.reveal.ts:245`);
      Escape currently IGNORES the return and has NO `escapeResolved` event; `captureHeroFromHq` returns
      `CaptureHeroResult | null`; KO resolvers are internal to `villainEffects.execute.ts`.
- [ ] `uiState.build.ts` projects `UIState.log = [...gameState.messages]` (no client edit).
- [ ] D-24081: `G.messages` excluded / `G.notableEvents` included in `finalStateHash`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- New type: `VillainEffectResult = { keyword: VillainEffectKeyword; targets: CardExtId[]; pending?: boolean }`
  in `rules/villainAbility.types.ts`. Additive — do NOT alter `VillainEffectKeyword`/descriptor types.
- Executor return widens to `VillainEffectResult[]` for ALL timings; dispatch order unchanged; out-of-vocab excluded.
- **Byte-identity map:** at `fightResolved` + `ambushResolved`, `appliedEffects = results.map((r) => r.keyword)`;
  the event array AND `composeFightNarrative`/`composeAmbushNarrative` string MUST be byte-identical to `main`.
- **Escape is LOG-ONLY:** push an `Escape effect: …` line; add NO `escapeResolved` (or any) notableEvent —
  `G.notableEvents` is hashed, a new event would re-pin the hash.
- Log lines: `Fight effect: …` / `Ambush effect: …` / `Escape effect: …`, emitted iff ≥1 effect applied,
  after that site's existing pushes (Fight/Ambush before their notableEvents push).
- Name resolution: at each fire site via `G.cardDisplayData[extId]?.name` (ext_id fallback); the composer
  is PURE (receives resolved names). Extract a shared name-resolution helper only at the 3rd identical copy.
- `gain-wound`/`capture-bystander` → `targets: []` (generic label, reuse `EFFECT_KEYWORD_LABELS`).
- ≥2-eligible current-player KO → `pending: true`, `targets: []` → "must KO a hero".
- Reserved decision: **D-24102**.

## Guardrails
- **Byte-identity is load-bearing.** If the sweep `finalStateHash` changes, or any `fightResolved`/
  `ambushResolved` event differs from `main`, or ANY new notableEvent appears (esp. on Escape) — STOP.
  `G.notableEvents` is hashed + projected to the arena-client; it must not observe the widening.
- Additive + read-side: NO gameplay/move/phase/zone-op/RNG change. Existing terse log lines UNCHANGED.
  Do NOT touch `composeFightNarrative`/`composeAmbushNarrative` output.
- Layer boundary: `notableEvents.compose.ts` + `villainAbility.types.ts` import NO `boardgame.io`,
  NO `@legendary-arena/registry`; keep the composer pure (no `G`). `villainEffects.execute.ts` keeps
  its `ctx as {...}` narrowing.
- Move contract: `fightVillain` returns `void`, never throws; push is post-mutation, length-guarded.
- Scope discipline: villain-deck timings ONLY. Do NOT touch `resolveKoHeroChoice`, `fightMastermind.ts`,
  the mastermind subsystem, or `data/cards`. Mastermind tactic effects are unimplemented (WP-024).
- No `.reduce()` in the executor/handlers; use `for...of` / explicit `.map(r=>r.keyword)`.

## Required `// why:` Comments
- The `results.map((r) => r.keyword)` at `fightResolved` + `ambushResolved` (why: preserve the WP-200
  keyword surface byte-identical so `finalStateHash` + the arena-client do not observe the widening).
- Escape being log-only with NO notableEvent (why: a new hashed event would re-pin `finalStateHash`).
- The length-guarded `G.messages` pushes (why: empty applied-results → no line).
- Name resolution living at the fire site, not the executor/composer (why: pure composer; `G.cardDisplayData`
  is the site's to read, D-11106 pattern).
- `pending: true` on the ≥2-eligible current-player KO (why: no hero KO'd yet; resolve-time naming deferred).

## Files to Produce
- `rules/villainAbility.types.ts` [+`VillainEffectResult`] · `rules/villainAbility.types.test.ts`.
- `villain/villainEffects.execute.ts` [handlers/resolvers return results; executor `VillainEffectResult[]`]
  · `villain/villainEffects.execute.test.ts` [per-handler targets / pending / no-op empties].
- `villainDeck/villainDeck.reveal.ts` [Ambush map→keywords byte-identical + `Ambush effect:` log; Escape
  capture return + `Escape effect:` log, NO new event] · `villainDeck/villainDeck.reveal.test.ts`
  [Ambush byte-identity + Ambush/Escape log + assert no new notableEvent].
- `moves/fightVillain.ts` [fightResolved map + name resolution + `Fight effect:` log]
  · `moves/fightVillain.test.ts` [per-target log + event/hash byte-identity + count adjust].
- `events/notableEvents.compose.ts` [result-aware pure log composer]
  · `events/notableEvents.compose.test.ts` [golden: per-target / pending / no-target / multi-effect].
- Governance: `docs/ai/DECISIONS.md` (D-24102), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` + `build` green; `pnpm -r build` 0.
- [ ] Sweep / fixture-replay `finalStateHash` **byte-identical** to the `main` capture.
- [ ] `git diff --name-only` = allowlist (engine-only; zero client/server/registry files).
- [ ] STATUS / DECISIONS (D-24102 Active) / WORK_INDEX (WP-316 `[x]`) / EC_INDEX (EC-346 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (defeat / ambush /
      escape a KO or HQ-capture villain → log names the specific hero for each timing).

## Common Failure Smells
- `finalStateHash` drift, a differing `fightResolved`/`ambushResolved`, or a NEW notableEvent (Escape) →
  the widening leaked into the hash/client surface.
- Adding an `escapeResolved` event "for symmetry" → re-pins the hash; Escape is log-only.
- Name resolution in the executor or composer → boundary/purity breach; resolve at the fire site.
- Effect line on a no-effect fight/ambush/escape → length guard missing/inverted.
- Naming a hero for a `pending` KO → the parked choice hasn't resolved; say "must KO a hero".
- Touching `resolveKoHeroChoice` / `fightMastermind.ts` / mastermind subsystem → out of scope.
- Any `apps/*`, `packages/registry`, or `boardgame.io` import in the touched engine files → breach.
- Engine edited but suite run without `pnpm -r build` first (fresh worktree) → false "still green".
