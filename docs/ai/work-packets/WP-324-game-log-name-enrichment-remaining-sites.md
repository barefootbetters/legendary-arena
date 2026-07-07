# WP-324 — Game Log Name Enrichment: Remaining Log Sites

**User-Visible Surface:** play.legendary-arena.com (the Game Log panel + WP-322 export).
Completes the readable-log pass WP-323 began: the remaining log lines that still
print a raw card/villain ext-id — fights, recruits, dodges, villain escapes,
bystander captures, victory-pile claims, and the synergy-gate/grant lines — now
read `{Name} ({ext-id})`, reusing the `logDisplay` helpers WP-323 built.

## Goal

Apply the WP-323 `logDisplay` helpers to the remaining player-facing
`G.messages.push` sites that embed a raw `CardExtId`, so the whole log reads with
display names. Add one small helper, `formatCardRef(cardDisplayData, extId)` =
`{Name} ({ext-id})` (the play label without the effect clause), and refactor
`formatPlayedCardLabel` to reuse it. Message text only — no engine state/logic/RNG
change.

## Assumes

- **WP-323 landed** (`origin/main` @ `d55265e1`): `packages/game-engine/src/log/logDisplay.ts`
  exports `resolveCardName`, `abilityTextToPlainText`, `formatPlayedCardLabel`; the
  card-play + mastermind-tactic lines are already enriched. `G.cardDisplayData` is
  in scope in moves and in `villainDeck.reveal` / `heroEffects.execute` /
  `effectPrimitive.interpret` (all receive `G`).
- `G.messages` is hash-excluded (D-24081); re-pinning the replay **message oracle**
  is mechanical (`scripts/record-game-fixture.mjs --input`, rebuild engine first).
- `composeEffectResultLogLine` already resolves names inside the "Fight/Ambush/Escape
  effect: …" lines (e.g. "(S.H.I.E.L.D. Agent)") — those are NOT re-authored here.
- `pnpm --filter @legendary-arena/game-engine test` + `pnpm -r build` pass on baseline.

## Context (Read First)

- `packages/game-engine/src/log/logDisplay.ts` (WP-323) — the helpers to reuse/extend.
- The enrichment sites (raw ext-id, player-facing): `moves/fightVillain.ts` (~164, ~169),
  `moves/recruitHero.ts` (~143), `moves/dodgeCard.ts` (~113),
  `villainDeck/villainDeck.reveal.ts` (~202, ~234, ~441),
  `moves/resolveVictoryPileCardPick.ts` (~167), `hero/heroEffects.execute.ts` (~306),
  `hero/effectPrimitive.interpret.ts` (the composed grant `message`, ~56/~543).
- `moves/fightMastermind.ts` (~88, ~137) + card-play lines — **already done (WP-323)**;
  do not touch.
- `docs/ai/DECISIONS.md` — D-24109 (WP-323 helpers + posture), D-24081 (hash-excluded),
  D-20002 (log authorship).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why now:** WP-323 named card plays + mastermind tactics, but the same match log still
shows raw ids on `recruited wtif/...#0`, `fought "henchman-sentinel-06"`,
`Bystander "bystander-villain-deck-10" ... captured by "core-villain-..."`, and
`claimed +8 attack from core-villain-skrulls-paibok-...`. This finishes the pass so the
log is uniformly named.

## Scope (In)

- **`logDisplay.ts`** — add `formatCardRef(cardDisplayData, extId): string` = `{Name}
  ({extId})`; refactor `formatPlayedCardLabel` to `formatCardRef(...)` + the effect
  clause (no behavior change to the play label). Add `formatCardRef` tests.
- **Enrich these lines to `{Name} ({ext-id})`** via `formatCardRef` / `resolveCardName`:
  - `fightVillain.ts` — `fought "{cardId}" at city space N` and `rescued … from "{cardId}"` (villain).
  - `recruitHero.ts` — `recruited {cardId}; HQ slot …` (hero card).
  - `dodgeCard.ts` — `dodged {cardId} (discarded …)` (card).
  - `villainDeck.reveal.ts` — `Villain "{escapedCard}" escaped …`, `Bystanders from escaped
    villain "{escapedCard}" …`, and `Bystander "{cardId}" revealed and captured by
    "{captorCardId}"` (name both).
  - `resolveVictoryPileCardPick.ts` — `claimed +N attack from {typedCardId} … (Ebony Blade)` (villain).
  - `heroEffects.execute.ts` — `Player X's {cardId} ability did not activate …` (hero card).
  - `effectPrimitive.interpret.ts` — the composed grant `message` that embeds a raw
    `cardId` (e.g. `Player X's {card} gained +N attack`) → name it at the composition site.
- **Re-pin** the affected move tests (`fightVillain.test.ts`, `recruitHero.test.ts`,
  `dodgeCard.test.ts`, and any others the scaffold surfaces) + the replay message oracle.

## Out of Scope

- **Generic / diagnostic / error / skip lines with no card id, or debug-only channels:**
  the "Villain deck reveal skipped…", reveal-rule-skipped predicate/action lines, the
  KO/optional-reward/victory-villain/draw-or-empowered *skip* lines, count-scaled-attack,
  and the `hollowEffect.record` diagnostic. These carry no player-facing card identity to
  name (or are a debug surface).
- **The "Fight/Ambush/Escape effect: …" lines** — already name-resolved via
  `composeEffectResultLogLine`; not re-authored.
- **`sendUndercover.ts` (`sent {instanceId} …`)** — uses a zone **instanceId**, not a
  `CardExtId` guaranteed to resolve via `cardDisplayData`; excluded pending an
  instanceId→ext-id resolution (a possible WP-325 item, not assumed here).
- **Card-play + mastermind-tactic lines** — WP-323, already done.
- **Effect OUTCOME logging** — whether an effect fired / the "What If…?" result — **WP-B**.
- **`G.cardDisplayData` shape / `buildCardDisplayData`**, engine state, move logic, RNG.
- **Client / `apps/arena-client`** — renders `UIState.log` verbatim; untouched.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/log/logDisplay.ts` | **Modified** — add `formatCardRef`; refactor `formatPlayedCardLabel` to reuse it |
| `packages/game-engine/src/log/logDisplay.test.ts` | **Modified** — `formatCardRef` tests |
| `packages/game-engine/src/moves/fightVillain.ts` | **Modified** — villain name+id on fought/rescued lines |
| `packages/game-engine/src/moves/recruitHero.ts` | **Modified** — card name+id on recruited line |
| `packages/game-engine/src/moves/dodgeCard.ts` | **Modified** — card name+id on dodged line |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` | **Modified** — villain/bystander names on escape + capture lines |
| `packages/game-engine/src/moves/resolveVictoryPileCardPick.ts` | **Modified** — villain name+id on the Ebony-Blade claim line |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — hero card name+id on the synergy-gate skip line |
| `packages/game-engine/src/hero/effectPrimitive.interpret.ts` | **Modified** — name the card in the composed grant message |
| `hero/effectPrimitive.interpret.test.ts`, `moves/recruitHero.test.ts`, `moves/dodgeCard.test.ts`, `villainDeck/villainDeck.reveal.test.ts` | **Modified** — re-pinned the 10 byte-locked assertions (scaffold-confirmed) to the `{extId} ({extId})` fallback |
| ~~replay fixture~~ | **Unchanged** — the `sentinel-core-doom-2p` trace plays only starters, so no fight/recruit/escape line was in its oracle; no re-pin needed |
| `docs/ai/DECISIONS.md` | **Modified** — D-24110 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-324 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-354 row |

Exact test/fixture file names are confirmed by the scaffold run and folded into this
allowlist before execution completes.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file — no diffs or snippets.
- ESM only (explicit `.js` on relative imports, incl. `import type`); Node v22+.
- Human-style code per `00.6-code-style.md`; no `.reduce()` in the helpers.

**Packet-specific:**
- **Message text only.** No change to `G` state, move logic, RNG, turn flow, or
  `G.cardDisplayData` shape. Only the authored strings change.
- **Format:** `{Name} ({ext-id})` (extends the WP-323 play format; keeps the ext-id for
  debug). No effect clause on these lines (they are not card plays).
- **Determinism:** `G.messages` is hash-excluded (D-24081) — no replay-outcome change;
  re-pin the fixture oracle by **regeneration**, never hand-edit divergent lines.
- **Defensive resolution:** absent `cardDisplayData` entry falls back to the raw ext-id
  (`resolveCardName`/`formatCardRef` `?? extId`) — never throws, never emits `undefined`.
- **`effectPrimitive` self-demotion:** if naming the composed grant message requires more
  than threading `cardDisplayData` into the existing builder (i.e. a real logic change),
  STOP and split that one site to WP-325 — do not widen this WP's shape.
- Do NOT touch `sendUndercover`, `composeEffectResultLogLine`, the excluded skip/diagnostic
  lines, the client, or the WP-323 (play/mastermind) lines.

**Session protocol:** if any scope/format/fixture question is ambiguous, STOP and ask.

**Locked contract values:**
- `formatCardRef(cardDisplayData, extId)` = `{Name} ({extId})`; `formatPlayedCardLabel` =
  `formatCardRef(...)` + ` — {plain effect}` when `abilityText` present (unchanged output).
- Name fallback: `cardDisplayData?.[extId]?.name ?? extId`.
- Reserved decision: **D-24110**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability — a uniformly readable log), §11
  (read-only projection). **Conflict assertion:** `No conflict.` **Non-Goal proximity:**
  none of NG-1..7 crossed. **Determinism:** `G.messages` hash-excluded (D-24081);
  replay-faithful (message text only).

## Acceptance Criteria

1. `formatCardRef(cardDisplayData, extId)` returns `{Name} ({extId})` when the entry
   exists and `{extId} ({extId})` on the name fallback (asserted); `formatPlayedCardLabel`
   output is unchanged (existing WP-323 tests still pass).
2. `fought "…"`, `rescued … from "…"` (villain), `recruited …`, `dodged …`,
   `Villain "…" escaped`, `Bystander "…" … captured by "…"`, and the Ebony-Blade
   `claimed … from …` lines all render `{Name} ({ext-id})` (asserted in the touched tests).
3. The hero synergy-gate skip line names the hero card `{Name} ({ext-id})`.
4. The `effectPrimitive` grant line names the card (or that one site is split to WP-325,
   documented in the WP + STATUS).
5. Excluded lines (skip/diagnostic/`composeEffectResultLogLine`) are unchanged.
6. Message text only: no engine-state / move-logic change; non-message assertions in the
   touched tests pass unchanged.
7. `pnpm --filter @legendary-arena/game-engine test` green (re-pinned tests + fixture);
   `pnpm -r build` clean.
8. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine test    # 0 fail (incl. re-pinned fixture)
pnpm -r build                                       # succeeds
git diff --name-only                                # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after
      merge + deploy, a live match's Game Log shows named recruits, fights, escapes,
      captures, and victory-pile claims; STATUS.md records the test evidence until then.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24110 Active; `WORK_INDEX.md` WP-324
      `[x]`; `EC_INDEX.md` EC-354 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All sections present; Out of Scope ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes: WP-323 helpers on main @ d55265e1, cardDisplayData in scope, fixture regen + hash-exclusion |
| 4 | ✅ PASS | §Context cites the helper + each enrichment site with line ranges + D-entries |
| 5 | ✅ PASS | §Files lists helper + 7 source + tests + fixture + governance; scaffold confirms exact test/fixture names |
| 6 | ✅ PASS | Canonical `cardDisplayData` / `CardExtId`; reuses WP-323 `resolveCardName` naming |
| 7 | ✅ N/A | No new npm dependency |
| 8 | ✅ PASS | Engine-internal; `logDisplay` stays pure (no boardgame.io); no layer crossing |
| 9 | ✅ N/A | No shell scripts introduced |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | `node:test`; helpers pure; boundary assertions on `formatCardRef`; fixture re-pinned deterministically |
| 13 | ✅ PASS | Verification uses `pnpm --filter`; exact commands + `git diff --name-only` |
| 14 | ✅ PASS | 8 binary, observable, line-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS/DECISIONS/WORK_INDEX + scope check; User-Visible Surface + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow; `formatCardRef` extracted (reused across ~8 sites, §16.1 satisfied); JSDoc + `// why:` |
| 17 | ✅ PASS | `## Vision Alignment` — §14/§11; no conflict; determinism (hash-excluded) |
| 18 | ✅ N/A | Verification greps `git diff --name-only`, not forbidden tokens |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface — engine log text |
| 21 | ✅ N/A | No HTTP endpoint / `apps/server` library function — game-engine only |

**Verdict: 21/21 resolved (12 PASS, 9 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Single layer (game-engine); the machinery already exists on `main`
(WP-323 `logDisplay`), so this is the same defensive `resolveCardName`/`formatCardRef`
one-liner applied at ~8 more sites. The one uncertain site — the `effectPrimitive` composed
grant message — carries an explicit self-demotion clause (split to WP-325 if it needs more
than threading `cardDisplayData`). Cost is the fixture/test re-pin, mechanical and
determinism-safe (D-24081). Standard two-session lane (>4 files + message-oracle change).

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine-internal, pure helper), no monetization/identity/RNG/
multiplayer-sync, no new contract, no engine-state or `finalStateHash` impact (message text
only, hash-excluded). Scope bounded to the remaining raw-ext-id lines; excluded lines and
the effect-outcome work are explicitly deferred. No BLOCK modes.
