# WP-726 — Auto-resolving hero-effect reveal observability (emit the WP-697 `heroEffectResolved` "Hero Ability" overlay from the player-deck-top reveal family, so an auto-resolving reveal names the flipped card + its grant on-screen)

**Status:** Draft
**Primary Layer:** Game Engine (a new narrative composer on `notableEvents.compose.ts` + the guarded `heroEffectResolved` emit inside the `heroEffectReveal` handler in `heroEffects.execute.ts`) + one Arena Client render test (the WP-697 `NotableEventOverlay.vue` already renders any `heroEffectResolved` narrative variant-agnostically — no client source change)
**Dependencies:** WP-697 / EC-734 / D-24516 (the `heroEffectResolved` `NotableGameEvent` variant + `NotableEventOverlay.vue` "Hero Ability" overlay + `composeHeroRevealAttackNarrative`, on `main`), WP-325 / D-24237 (the per-peeked-card reveal-outcome log line in `applyRevealRules` this reads `matchedPredicateText` / `matchedActionPhrases` / `topCardId` / `revealLogOutcome` from, on `main`), WP-219 / D-21901+D-21902 + WP-217/218/220/223 (the auto-resolving `reveal-*` executor family — `reveal-cost-attack`, `reveal-odd-draw`, `reveal-min`, `reveal-ko`, `reveal-ko-or-draw`, `reveal-ko-attack` — dispatched through `heroEffectReveal`, on `main`)

**User-Visible Surface:** `play.legendary-arena.com` (the in-match center-screen "Hero Ability" overlay)

> Baseline: `origin/main` @ `ba472a07` (the WP-726 / EC-763 / D-24547 reserve commit) or later — the `heroEffectResolved` variant, its overlay, the `heroEffectReveal` reveal family, and the WP-325 reveal-outcome log line are all present.

---

## Goal

After this session, when a player plays a hero card whose ability **auto-resolves** a deck-top reveal — the `heroEffectReveal` family: Gambit *High Stakes Jackpot* (`core/gambit/high-stakes-jackpot`, `reveal-cost-attack`), plus the `reveal-odd-draw` / `reveal-min` / `reveal-ko` / `reveal-ko-or-draw` / `reveal-ko-attack` siblings — the engine emits a **`heroEffectResolved` notable event** (the WP-697 / D-24516 mechanism) naming the revealed card and what it produced, e.g. *"Player 1 revealed Sneak Attack (cost 4) with High Stakes Jackpot and gained +4 attack."* That event rides the already-public `UIState.notableEvents` projection into the arena-client's existing `NotableEventOverlay.vue`, which renders it center-screen under the "Hero Ability" chip with **no client source change** (the overlay is variant-agnostic). This closes an observability gap: today the reveal is FAITHFUL (`applyRevealAttackByCost` peeks the deck top and grants `G.turnEconomy.attack += cost`) but INVISIBLE — because the reveal auto-resolves (it parks no pending choice), the flipped card and grant reach only `G.messages` (which is not projected to clients), so the player sees "nothing happened." A live 1p Magneto / *Portals to the Dark Dimension* match (X-23 + Wolverine + Gambit) surfaced exactly this: High Stakes Jackpot read as "didn't reveal the top card," with `heroEffectResolved: 0` in the match diagnostics.

---

## Context (Read First)

- `.claude/rules/architecture.md §UIState Projection Integrity` (the **Board-Visible Field Rule**) — the governing caution for any client-visible projection. **This WP adds no new UIState field:** it emits an existing `heroEffectResolved` variant into the already-public, unconditional `UIState.notableEvents` array (whitelisted in `uiState.filter.ts` as `notableEvents: [...uiState.notableEvents]` for every audience). The 5-step field contract is therefore **N/A** — but a new filter test still asserts the event survives `filterUIStateForAudience` (that assertion is absent today).
- `.claude/rules/architecture.md §G and ctx Are Runtime-Only` + `docs/ai/ARCHITECTURE.md §Persistence Boundaries` — `G.notableEvents` is runtime-only per application code; this WP adds no persisted state.
- `docs/ai/DECISIONS.md` — scan D-24516 (the `heroEffectResolved` overlay decision + why Option A, the notable event, was chosen over surfacing `effectTraces`), D-20001 (the card-less minimal `{type,playerId,narrative}` notable-event payload), D-24081 (`G.messages` is excluded from the `finalStateHash` oracle but STAYS in `computeStateHash` — why the log path is not the client surface), D-24237 (the WP-325 reveal-outcome line), D-12803 (the audience-filter public/redacted matrix — `notableEvents` is public). This WP lands **D-24547** (reserved).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectReveal` (the deck-top reveal-family handler, ~line 1522) delegates each peeked card's outcome to `applyRevealRules` (~line 1640), which already composes a per-peeked-card WP-325 log line and pushes it via `pushLog(...)` (~line 1703) with `matchedPredicateText`, `matchedActionPhrases`, `topCardId`, and `revealLogOutcome` (`applied` / `partial` / `blocked`) in scope. That push site is the co-located emit point. Contrast `heroEffectRevealHeroDeckAttack` (~line 2253), which already emits `heroEffectResolved` at its last step (~line 2341) — the exact pattern this WP replicates for the deck-top family.
- `packages/game-engine/src/events/notableEvents.compose.ts` — `composeHeroRevealAttackNarrative` (line 433) is the WP-697 hero-deck-reveal composer; the new `composeHeroRevealTopNarrative` sits beside it, pure and byte-stable.
- `packages/game-engine/src/events/notableEvents.types.ts` — the `HeroEffectResolvedEvent { type:'heroEffectResolved'; playerId:string; narrative:string }` shape (all required, card-less, D-20001). **Reused unchanged** — no new event type, no new field, no `NOTABLE_EVENT_TYPES` drift-array touch.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the overlay: `CHIP_LABELS.heroEffectResolved = 'Hero Ability'`, renders `event.narrative` verbatim, suppresses the card-name row for this variant (`eventCardId` returns `''`). Variant-agnostic → renders a new reveal-family emission with **no source change**.
- `packages/game-engine/src/replay/replay.hash.ts` (`computeStateHash`) + `packages/game-engine/src/test/fixtures/hashGameState.ts` — **both** oracles hash `G.notableEvents` (it is explicitly NOT excluded: `hashGameState.ts:12`, `:77-78`); only `messages` / `logMeta` / `lastPlayEffectsFired` / `diagnostics` are excluded. The determinism story below turns on this.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` + `PRE_WP080_HASH` (`replay/replay.execute.test.ts`) — the two pinned hash oracles.
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code (referenced by the constraints below).
- Auto-memories: `project_hero_effect_resolved_overlay` (WP-697 mechanism + "future invisible-work families reuse the same type with their own narrative composer, only the narrative differs"), `project_hero_effect_observability` (why silent hero effects read as dead; "adding to `notableEvents` still re-pins" but WP-697 needed none as no fixture exercised the path), `reference_hashed_g_field_dual_repin` (the dual re-pin: sentinel via recorder + `PRE_WP080_HASH` constant — and that `notableEvents` IS hashed), `reference_uistate_filter_whitelist_drops_fields` (the filter-drop caution; `notableEvents` is a required unconditional field, so it does not fall into the trap).

---

## Assumes

- **WP-697 on `main`:** `packages/game-engine/src/events/notableEvents.types.ts` exports `HeroEffectResolvedEvent { type:'heroEffectResolved'; playerId:string; narrative:string }` as the eleventh `NotableGameEvent` variant; `notableEvents.compose.ts` exports `composeHeroRevealAttackNarrative`; `heroEffects.execute.ts` `heroEffectRevealHeroDeckAttack` emits the event guarded by `Array.isArray(G.notableEvents)`; `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders any `heroEffectResolved` event under the "Hero Ability" chip via `event.narrative`, with the card-name row suppressed for the variant.
- **Projection on `main`:** `UIState.notableEvents: NotableGameEvent[]` is built in `uiState.build.ts` (`const notableEvents = [...gameState.notableEvents];`) and passed through `uiState.filter.ts` as `notableEvents: [...uiState.notableEvents]` in the **main unconditional whitelist** — fully public for every audience (players + spectators), no redaction (D-12803).
- **WP-325 on `main`:** `applyRevealRules` (`heroEffects.execute.ts`) composes a per-peeked-card outcome and pushes a `LOG_OUTCOMES`-coloured line via `pushLog(G, formatRevealOutcomeLine(...), revealLogOutcome, topCardId)`, with `matchedPredicateText`, `matchedActionPhrases`, and `revealLogOutcome ∈ {applied, partial, blocked}` in scope at the push site.
- **Reveal family on `main`:** `heroEffectReveal` handles the auto-resolving `reveal-*` family (`reveal-cost-attack`, `reveal-odd-draw`, `reveal-min`, `reveal-ko`, `reveal-ko-or-draw`, `reveal-ko-attack`); `reveal-attack-choose` (WP-220) additionally parks a `pendingHeroChoice` via the `choose-discard-or-return` action, and `reveal-top-dispose` (WP-702) parks its own visible pending choice — those PARK cases already surface via the pending-choice UI and are OUT of scope.
- **Determinism oracles on `main`:** `G.notableEvents` is hashed by **both** `computeStateHash` (`replay.hash.ts`, the PRE_WP080 / replay oracle) and `hashGameState` (the `finalStateHash` sentinel oracle) — it is explicitly not excluded (only `messages`/`logMeta`/`lastPlayEffectsFired`/`diagnostics` are). The sentinel is `sentinel-core-doom-2p.replay.json`; `PRE_WP080_HASH` is an empty replay.
- **`CardExtId` on `main`:** `type CardExtId = string`; the revealed deck-top id is a `CardExtId`.

---

## Scope (In)

### A) Engine — the narrative composer (`packages/game-engine/src/events/notableEvents.compose.ts`)
- Add a pure `composeHeroRevealTopNarrative(sourceCardName: string, revealedCardName: string, cost: number, outcomeText: string): string` beside `composeHeroRevealAttackNarrative`. It returns a single byte-stable **third-person** English sentence naming the source hero card, the revealed deck-top card + its cost, and what the reveal produced — e.g. `"High Stakes Jackpot revealed Sneak Attack (cost 4) — gained +4 attack."`. **No "Player N" prefix** (matches the sibling `composeHeroRevealAttackNarrative`'s deliberate no-player voice, `compose.ts:422-424`: the acting seat travels on the event's `playerId` field, not in the copy — the overlay renders no player row; this avoids the boardgame.io 0-based index ambiguity). `outcomeText` is composed by the caller from the matched reveal action(s) (the same phrasing the WP-325 log summarises); the composer only assembles, it does no lookups (purity per D-20001). JSDoc + a `// why:` citing WP-726 / D-24547 as the reveal-family sibling of `composeHeroRevealAttackNarrative`.

### B) Engine — the guarded emit (`packages/game-engine/src/hero/heroEffects.execute.ts`)
- In `applyRevealRules`, immediately after the existing WP-325 `pushLog(...)` (~line 1703), emit ONE `heroEffectResolved` notable event for the peeked card **when all hold**: (1) a predicate matched (`matchedPredicateText !== undefined`); (2) the matched actions did **not** include the choose action (`choose-discard-or-return`) — a parking reveal (`reveal-attack-choose`) surfaces via the pending-choice UI, not this overlay; (3) `revealLogOutcome !== 'blocked'` (the reveal realized work — `applied` or `partial`); (4) `Array.isArray(G.notableEvents)` (the WP-697 best-effort guard — a minimal test `G` omits it). Resolve the source-card and revealed-card display names via the shared display resolver the WP-697 emit uses (`resolveTransformCardName`, same file, raw-ext_id fallback), compose the `outcomeText` from `matchedActionPhrases`, and push `{ type:'heroEffectResolved', playerId: playerID, narrative: composeHeroRevealTopNarrative(sourceCardName, revealedCardName, cost, outcomeText) }` — the acting seat rides on the event's `playerId` field, not in the narrative copy. The `sourceCardId` (the played hero card) is threaded into `applyRevealRules` as an added parameter (it is already known one frame up in `heroEffectReveal` at the `applyRevealRules(...)` call — pass it through) so the narrative can name the source hero. No behavior change to the reveal itself: the peek, the grant, the deck, and the WP-325 log line are byte-identical; only a notable event is appended.

### C) Engine tests (`packages/game-engine/src/events/notableEvents.compose.test.ts` + `packages/game-engine/src/hero/heroEffects.execute.test.ts`)
- `notableEvents.compose.test.ts` — `composeHeroRevealTopNarrative` returns the exact golden sentence for a `reveal-cost-attack` grant and for a `reveal-odd-draw` draw; it is pure (same inputs → same string; no `G`/registry read).
- `heroEffects.execute.test.ts` — a `reveal-cost-attack` play (High Stakes Jackpot) emits exactly one `heroEffectResolved` whose `narrative` names the revealed card + cost + `+N attack`; a `reveal-odd-draw` / `reveal-ko` play emits one naming the respective outcome; a **`reveal-attack-choose`** play (which parks a choice) emits **no** `heroEffectResolved` (the pending-choice UI owns it); a **below-threshold / empty-deck (`blocked`)** reveal emits none; the emit is guarded (no throw on a minimal mock omitting `G.notableEvents`); and the reveal's grant + `G.messages` line + deck order are byte-identical with and without the emit (the observability append changes nothing else).

### D) Arena Client render test (`apps/arena-client/src/components/play/NotableEventOverlay.test.ts`)
- Assert a `heroEffectResolved` event carrying a reveal-family narrative renders the "Hero Ability" chip + the narrative verbatim with no card-name row (the variant-agnostic overlay handles the new emission — the D-24026 client-render aid). **No `NotableEventOverlay.vue` source change.**

---

## Out of Scope

- **Rendering the flipped card's IMAGE.** v1 names the revealed card in the narrative text (the WP-697 card-less `{type,playerId,narrative}` payload, D-20001). Adding an optional `revealedCardId` to `HeroEffectResolvedEvent` so the overlay renders the card art is a genuine field addition — the full Board-Visible Field Rule 5-step + the `uiState.types.drift.test.ts` keyset pin + un-suppressing the overlay's card row — and is a named refinement follow-up, not this slice.
- **The parking reveals** (`reveal-attack-choose`, WP-220; `reveal-top-dispose` / Melter, WP-702/WP-603). These park a **visible** pending choice that already surfaces the revealed card(s) in the arena-client prompt; adding an overlay would double-surface. Explicitly excluded by the emit gate (condition B-2).
- **The `G.messages` reveal log line.** The WP-325 per-card line stays exactly as-is; this WP appends an observability event, it does not change the log.
- **The count-scaled hero-deck reveal** (`heroEffectRevealHeroDeckAttack`, WP-668) — it already emits `heroEffectResolved` (WP-697); untouched.
- **Villain / mastermind / henchman reveals**, the Play-Diagnostics `effectTraces` channel (WP-575/WP-706), and any new SFX — the `heroEffectResolved` "Hero Ability" cue already exists (WP-697 `sfxManifest`), reused as-is.
- **Any gameplay-outcome change.** This WP surfaces what the engine already computes; it changes no grant, no move, no phase, no zone.

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.compose.ts` — modified — add `composeHeroRevealTopNarrative`
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — modified — golden + purity for the new composer
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — the guarded `heroEffectResolved` emit in `applyRevealRules` + the `sourceCardId` pass-through param
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — modified — emit-on-auto-resolve / no-emit-on-park-or-blocked / guarded / byte-identical-grant
- `packages/game-engine/src/ui/uiState.filter.test.ts` — modified — a filter regression test asserting `notableEvents` (carrying a `heroEffectResolved` reveal event) survives `filterUIStateForAudience` for every audience (absent today)
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — modified — the reveal-family narrative renders (no `.vue` change)

Governance / generated artifacts (`STATUS.md`, `DECISIONS.md` lands D-24547, `WORK_INDEX.md`, `EC_INDEX.md`, `NUMBER-LEDGER.md` mark reservations landed, `05-ROADMAP-MINDMAP.md` + its count table) ride the governance-close commit (the universal repo pattern). **Conditional (determinism) allowlist:** IF the empirical determinism check (below) shows a pinned oracle shifts, the dual re-pin touches `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` (via `scripts/record-game-fixture.mjs`, never hand-edited) + `PRE_WP080_HASH` in `packages/game-engine/src/replay/replay.execute.test.ts` — behavior-neutral, per `reference_hashed_g_field_dual_repin`; if the check shows byte-unchanged (expected), neither is touched.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Produce **full file contents** for every new or modified file. Diffs, snippets, and "show only the changed section" are forbidden.
- ESM only; Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: explicit control flow, descriptive names, no `.reduce()` in the compose/emit path (use `for...of`), no nested ternaries, a JSDoc on every function.
- Determinism: no `Math.random()` / wall-clock / I/O in engine code; the composer is pure; the emit only appends to `G.notableEvents`.

**Packet-specific:**
- **Determinism (the safety contract — READ CAREFULLY).** `G.notableEvents` is hashed by **both** oracles (it is NOT excluded — only `messages`/`logMeta`/`lastPlayEffectsFired`/`diagnostics` are). Emitting a new `heroEffectResolved` for the reveal family therefore changes both hashes **for any pinned fixture that plays a reveal-family card**. The core-only sentinel (`sentinel-core-doom-2p.replay.json`) and the empty `PRE_WP080` replay play **no** deck-top-reveal hero, so both oracles are expected **byte-unchanged** — this is the WP-697 outcome exactly. **VERIFY empirically:** run the replay/sentinel/determinism suite. If a pin shifts, a committed fixture DOES exercise the reveal family: re-pin **honestly** via the dual re-pin (`scripts/record-game-fixture.mjs` for the sentinel + the `PRE_WP080_HASH` constant with a provenance comment), never hand-edit a pin to force green, never route the event to a non-hashed channel to dodge the pin.
- **Reveal behavior is untouched.** The peek, the grant (`G.turnEconomy`), the deck order, the KO/draw, and the WP-325 `G.messages` line are byte-identical with and without the emit. Assert it: the same reveal fixture produces the same grant + same messages with the event appended.
- **Auto-resolve only.** Emit only when the reveal did NOT park a choice (no `choose-discard-or-return` action matched) and realized work (`revealLogOutcome !== 'blocked'`). Parking reveals surface via the pending-choice UI; a doubled overlay is a bug.
- **Reuse the WP-697 variant.** No new `NotableGameEvent` type, no new field on `HeroEffectResolvedEvent`, no `NOTABLE_EVENT_TYPES` drift-array change. The overlay renders the new emission with no client source change; the client touch is a render test only.
- **Guarded + best-effort.** The emit is wrapped in `Array.isArray(G.notableEvents)` (the WP-697 pattern); handlers never throw.

**Session protocol:** if any scope classification is ambiguous — a new event field, a second emit site, a determinism re-pin whose cause is unclear, a contract-file touch — STOP and re-read `.claude/rules/architecture.md` + `.claude/rules/code-style.md`; do not guess or expand scope.

**Locked contract values (do not re-derive):**
- `composeHeroRevealTopNarrative(sourceCardName: string, revealedCardName: string, cost: number, outcomeText: string): string` — pure; assembles one byte-stable **third-person** sentence (NO "Player N" prefix — the sibling composer's voice; seat travels on the event `playerId`); no `G`/registry read.
- `HeroEffectResolvedEvent { type:'heroEffectResolved'; playerId:string; narrative:string }` — reused verbatim from WP-697 (D-20001 card-less payload). No field added.
- Emit gate (all four): `matchedPredicateText !== undefined` AND matched actions exclude `choose-discard-or-return` AND `revealLogOutcome !== 'blocked'` AND `Array.isArray(G.notableEvents)`.
- Emit site: `applyRevealRules` in `heroEffects.execute.ts`, immediately after the WP-325 `pushLog(...)`; `sourceCardId` threaded in as an added parameter from the `heroEffectReveal` caller. No new fire site; no `heroEffectReveal` signature change beyond the existing internal call.
- Determinism: `G.notableEvents` is hashed by BOTH oracles; NO re-pin expected because no pinned fixture plays a deck-top-reveal hero — VERIFY empirically; dual re-pin (sentinel recorder + `PRE_WP080_HASH`) ONLY if a pin actually shifts.

---

## Vision Alignment

**Vision clauses touched:** §8 (Determinism guarantees) — the emit appends to the hashed `G.notableEvents`, so it is determinism-adjacent; §22 (replay faithfulness) — the appended event must not perturb replay beyond an honest re-pin; NG-1 (no pay-to-win) — this is display-only observability.

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`

**Non-Goal proximity check:** NG-1..7 preserved — surfacing a reveal on-screen is display-only observability of what the engine already computed; it never changes a game outcome, Victory Points, PAR, standing, or any competitive result, and touches no monetization, identity, or PvP surface.

**Determinism preservation:** the reveal's grant and every mutation are byte-identical; only a `heroEffectResolved` event is appended to `G.notableEvents`. Because `notableEvents` is hashed by both oracles, the change is byte-inert **only** where no pinned fixture plays a deck-top-reveal hero — expected true for the core-only sentinel and the empty PRE_WP080 replay (the WP-697 precedent), VERIFIED empirically at execution; if a pin shifts, it is re-pinned honestly via the dual re-pin (behavior-neutral). No pin is ever edited to force green, and the event is never re-routed to a non-hashed channel to dodge a pin.

## Funding Surface Gate

N/A — no funding affordance, channel, or user-visible funding copy; this is gameplay observability. (Per §20.1: none of the WP-097 §A/§B/§C surfaces are touched.)

## API Catalog

N/A — no HTTP endpoint added/modified/removed, and no `apps/server/src/**` library function touched; this is a game-engine change surfaced through the existing WP-697 notable-event projection, with no server surface.

---

## Acceptance Criteria

- [ ] `composeHeroRevealTopNarrative` returns the exact golden third-person sentence (no "Player N" prefix) naming the source hero card, revealed card + cost, and outcome for a `reveal-cost-attack` grant and a `reveal-odd-draw` draw; it is pure (no `G`/registry read).
- [ ] A `reveal-cost-attack` play (High Stakes Jackpot) emits exactly one `heroEffectResolved` whose `narrative` names the revealed deck-top card + its cost + `+N attack`.
- [ ] A `reveal-odd-draw` / `reveal-ko` play emits one `heroEffectResolved` naming the respective outcome; a `reveal-attack-choose` play (which parks a choice) emits **none**; a `blocked` (below-threshold / empty-deck) reveal emits **none**.
- [ ] The emit is guarded — no throw on a minimal mock `G` omitting `G.notableEvents`.
- [ ] The reveal's grant (`G.turnEconomy`), the deck order, any KO/draw, and the WP-325 `G.messages` line are byte-identical with and without the emit.
- [ ] A `heroEffectResolved` event carrying a reveal-family narrative renders the "Hero Ability" chip + the narrative verbatim (no card-name row) in `NotableEventOverlay.test.ts`, with no `NotableEventOverlay.vue` source change.
- [ ] `notableEvents` (carrying a `heroEffectResolved` reveal event) survives `filterUIStateForAudience` for every audience value-unchanged (a filter regression test — absent today).
- [ ] Determinism: the replay/sentinel/determinism suite result is recorded — **byte-unchanged expected** (`PRE_WP080_HASH` + the sentinel `finalStateHash`); if a pin shifted, the dual re-pin is applied honestly and the shifted fixture named. `pnpm -r build` 0; full engine suite green; arena-client `vue-tsc` 0 + suite green.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; replay/sentinel hash pins UNCHANGED (no re-pin — the core-only sentinel plays no deck-top-reveal hero). If a pin shifts, a committed fixture plays the reveal family: re-pin honestly (dual) and name it.

pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: vue-tsc 0; all tests pass (incl. the reveal-narrative overlay render)

Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "heroEffectResolved"
# Expected: at least two matches — the existing heroEffectRevealHeroDeckAttack emit AND the new applyRevealRules emit

Select-String -Path "packages\game-engine\src\events\notableEvents.compose.ts" -Pattern "export function composeHeroRevealTopNarrative"
# Expected: exactly one match — the new reveal-family composer
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com` "Hero Ability" overlay, D-24026):** in a real deployed match, play a hero whose ability auto-resolves a deck-top reveal (Gambit *High Stakes Jackpot* in a Gambit loadout) and confirm the center-screen "Hero Ability" overlay names the revealed card + the grant. (Confirm the deployed bundle's `gitSha` is a descendant of this WP's merge commit first — the WP-697 live-verify method; the exported match-diagnostics `uiStateSnapshot.notableEvents` shows the `heroEffectResolved` entry.)
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + arena-client suites pass; `vue-tsc` 0.
- [ ] `docs/ai/DECISIONS.md` — land D-24547 (Active).
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ counts), `NUMBER-LEDGER.md` (mark reservations landed) updated in the governance-close commit; no files outside `## Files Expected to Change` (plus the governance + conditional-determinism artifacts) modified.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `## Out of Scope` lists ≥2 explicit exclusions (the card-image render; the parking reveals; the log line; the count-scaled reveal).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Node22, 00.6 reference) + packet-specific (determinism/hashed-notableEvents, reveal-untouched, auto-resolve-only, reuse-WP697-variant, guarded) + session protocol + locked contract values.
- **§3 Assumes** — PASS. WP-697 / WP-325 / the reveal family / the projection / the determinism oracles named with exact exports/paths and required shapes.
- **§4 Context (Read First)** — PASS. Specific files + D-entries + the Board-Visible Field Rule + memories, each with the reason it is read.
- **§5 Files** — PASS. Two engine source files (composer, executor) + three engine test files (compose, executor, filter-regression) + one arena-client render test = six, bounded (≤8), each named and marked; no ambiguous "update this section" language; the conditional determinism-repin files are called out explicitly.
- **§6 Naming** — PASS. `composeHeroRevealTopNarrative`, `heroEffectResolved`, `HeroEffectResolvedEvent`, `CardExtId` used verbatim; no abbreviations; no 00.2 field surface touched.
- **§7 Dependencies** — PASS. No new npm dependency.
- **§8 Boundaries** — PASS. Engine emits the event + owns the projection; the arena-client only renders the existing variant (no source change, test-only); no DB/WebSocket/registry-at-runtime; `notableEvents` persistence posture (runtime-only) preserved.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env / §11 Auth** — N/A (no env vars; no authentication surface).
- **§12 Tests** — PASS. engine `node:test` + arena-client test; no `boardgame.io/testing`; deterministic.
- **§13 Verification** — PASS. Exact `pnpm` commands + the no-re-pin expectation + the two-emit-sites + composer-present greps.
- **§14 Acceptance** — PASS. Eight binary, observable, file/function-specific checks aligned to scope.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope-boundary check + the D-24026 live-on-surface item (surface ≠ `none`).
- **§16 Code style** — PASS. `for...of` in the emit/compose path, explicit control flow, JSDoc required, no premature abstraction (the composer is a single new function beside its sibling; the emit reuses the existing display resolver).
- **§17 Vision** — PASS. `## Vision Alignment` present with §8/§22/NG-1 clauses + the determinism-preservation line.
- **§18 Prose-vs-grep** — PASS. The `heroEffectResolved` grep is a presence check (≥2 matches) and the composer grep is scoped to `export function composeHeroRevealTopNarrative`; neither is a forbidden-token false-positive gate.
- **§19 Bridge** — N/A (not a repo-state-summarizing artifact).
- **§20 Funding** — N/A with justification (no WP-097 §A/§B/§C surface, no funding copy).
- **§21 API Catalog** — N/A with justification (no `apps/server` endpoint or library function).

**Lint verdict: PASS (all 21 resolved).**

---

## Gate Verdicts (executed in the drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent, one pass, no blocking PS findings). Verified against the real repo: `HeroEffectResolvedEvent {type,playerId,narrative}` (all required, `notableEvents.types.ts:424-431`); `composeHeroRevealAttackNarrative` (`compose.ts:433`); the executor sites (`heroEffectReveal:1522` → `applyRevealRules:1640`, WP-325 `pushLog:1703-1708` with `matchedPredicateText`/`matchedActionPhrases`/`topCardId`/`revealLogOutcome` in scope; `heroEffectRevealHeroDeckAttack:2253` already emits at `:2341`); the overlay is variant-agnostic (`NotableEventOverlay.vue:196` renders `event.narrative`, card row suppressed) → NO client source change; `G.notableEvents` hashed by BOTH oracles (`hashGameState.ts:8-13,106-109` + `replay.hash.ts:78`); the ONLY committed fixture (`sentinel-core-doom-2p.replay.json`, heroes `black-widow`/`captain-america`) plays no deck-top-reveal hero and `PRE_WP080_HASH` is empty → **no re-pin expected**, conditional allowlist stays dormant; the auto-resolve gate is sound (`reveal-attack-choose` → `{always,[choose-discard-or-return]}`, `revealRule.ts:244`); baseline `ba472a07` valid.
- **RS dispositions:** RS-1 (the golden sentence embedded "Player N", diverging from the sibling composer's deliberate no-player third-person voice) — **APPLIED**: `composeHeroRevealTopNarrative` drops the `playerId` param and the "Player N" prefix; the seat rides on the event `playerId`. RS-2 (0-based index ambiguity) — **moot** once RS-1 dropped the prefix. RS-3 (the WP-325 `pushLog` sits inside `if (Array.isArray(G.messages))`, so the emit is transitively `messages`-gated) — **folded into the EC + session prompt** (tests seed both arrays, or hoist). RS-4 (use the existing `revealRulesContainAnyAction(rules,['choose-discard-or-return'])`, not a hand-rolled kind accumulator) — **folded into the EC**. RS-5 (`_cardId` → `cardId` rename, single site) — **folded into the EC**. None change scope.
- **Copilot (01.7): PASS — CONFIRM** (independent subagent, one pass, no RISK/BLOCK). Scanned all 30 modes; independently verified the six highest-exposure ones against source: the auto-resolve gate correctly suppresses the parking `reveal-attack-choose` via `revealRulesContainAnyAction(rules,['choose-discard-or-return'])` (`:1538/:1545`) while covering the auto-resolving family (the choose rule's predicate is `always`, so a rule-presence check is exact); the Board-Visible Field Rule "no new field" claim is correct (`notableEvents: [...uiState.notableEvents]` at `uiState.filter.ts:527` is in the unconditional public whitelist — 5-step genuinely N/A); the composer signature (4-param, no `playerId`) matches both docs + the sibling's third-person voice; the tests are non-vacuous (no-emit-on-park / no-emit-on-blocked / byte-identical-grant / guarded); the determinism framing is honest + non-gameable (empirical verify + dual re-pin, no pin-editing). Execution-critical carry (RS-3, already locked in the EC + carried to the session prompt): the emit point in `applyRevealRules` sits inside `if (Array.isArray(G.messages))` (`:1682`, where `revealLogOutcome` is declared), so tests must seed BOTH `messages` + `notableEvents` (or hoist `revealLogOutcome` and emit after the block). No governance follow-ups; session-prompt generation authorized.

## See Also

- [WP-697](WP-697-hero-effect-resolved-overlay.md) / D-24516 — the `heroEffectResolved` "Hero Ability" overlay + `composeHeroRevealAttackNarrative` this WP extends to the deck-top reveal family
- WP-325 / D-24237 — the `applyRevealRules` reveal-outcome log line this reads the matched predicate/actions/outcome from
- WP-219 / D-21901+D-21902 + WP-217/218/220/223 — the auto-resolving `reveal-*` executor family surfaced here (the parking `reveal-attack-choose` explicitly excluded)
- `project_hero_effect_resolved_overlay`, `project_hero_effect_observability`, `reference_hashed_g_field_dual_repin`, `reference_uistate_filter_whitelist_drops_fields` — the overlay mechanism, the silent-effect diagnosis, the dual re-pin + hashed-`notableEvents` fact, and the filter-drop caution
