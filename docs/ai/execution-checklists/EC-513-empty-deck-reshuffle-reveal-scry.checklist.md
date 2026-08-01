# EC-513 — Empty-Deck Reshuffle for Reveal + Scry Effects (Execution Checklist)

**Source:** docs/ai/work-packets/WP-478-empty-deck-reshuffle-reveal-scry.md
**Layer:** Game Engine

## Before Starting
- [ ] On `origin/main` ≥ `bbdfdf4b` (WP-477 merged); D-24285 reserved in the ledger.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline pass count)
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` (zone ops, determinism, the `ctx as ShuffleProvider` narrowing precedent).

## Locked Values (do not re-derive)
- The rule: *"Whenever you need to draw OR reveal cards and your deck is empty,
  shuffle your discard pile to form a new deck — this can happen mid-effect."*
- Helper: `reshuffleDiscardIntoDeck(playerZones, shuffleContext)` — when
  `discard.length > 0`: `deck := [...deck, ...shuffleDeck(discard, shuffleContext)]`,
  `discard := []`; else no-op. **Append after any cards already on top.** Home:
  `packages/game-engine/src/moves/drawCards.logic.ts` (exported).
- Hero reveal: reshuffle when `peekOffset >= deck.length` and a card is owed;
  `return` only when the discard is also empty. Covers the WHOLE reveal family via
  the one peek loop.
- Villain scry: reshuffle when `deck.length < 2` (top up toward look-2) BEFORE the
  unchanged `0 → no-op / 1 → auto-KO / ≥2 → park` branch.
- `executeVillainAbilities` gains a trailing `shuffleContext: ShuffleProvider` param — threaded in-file through `applyVillainEffect` + the shared `VillainEffectHandler` type behind `VILLAIN_EFFECT_HANDLERS`, so all 8 handler signatures stay compatible (only the scry handler reads it).
- `ShuffleProvider` = `{ random: { Shuffle: <T>(deck: T[]) => T[] } }` (from
  `packages/game-engine/src/setup/shuffle.ts`) — reuse, do not redefine.

## Guardrails
- **Determinism:** the ONLY randomness is the injected `ctx.random.Shuffle` (via
  `shuffleDeck`). No `Math.random`, no `Date`, no I/O. The helper takes the provider
  as an argument — never reach for a global RNG.
- **No new `G` field, no new pending state, no snapshot change, no new
  keyword/primitive/effect/phase/stage** — so NO canonical-array / union / drift
  edits. This is a behavior fix inside existing handlers, not a contract addition.
- **Non-empty-deck path must stay byte-identical.** The reshuffle branch is only
  reached when the deck is exhausted; every existing reveal-family + scry test that
  never empties the deck must pass unchanged (WP-253 count=2, the 8 legacy reveal
  tests, WP-447 auto-pick, WP-470 interactive park).
- **Do NOT refactor `drawCardsIntoHand`** onto the new helper (its full-replace
  path is determinism-critical and only reached on an already-empty deck).
- **Helper stays pure** — no `boardgame.io` import in `drawCards.logic.ts`; use
  `moveAllCards` / `shuffleDeck`, no `.reduce()`.
- **Villain threading:** pass the move `random` from all three callers
  (`fightVillain.ts` onFight; `villainDeck.reveal.ts` onEscape + onAmbush). Do NOT
  read `random` off the bare bgio `ctx` (it isn't there) — thread it as the new
  param, mirroring the `villainDeck.reveal.ts` `RevealContext` precedent.
- **Scry branch logic is frozen** — WP-478 only tops up the deck before it; the
  pending state, block-all guard, UIState projection, prompt, resolve move, and bot
  default are untouched.
- **Reshuffle terminates** — the `discard.length > 0` guard means once nothing
  remains anywhere the handlers fall through to their existing no-op `return`.
- **Existing "empty deck → no-op" tests default `discard: []`** (both empty), so
  they stay valid unchanged — the reshuffle no-ops when the discard is empty. Do
  NOT rewrite them; ADD the empty-deck + NON-empty-discard cases (AC-2 / AC-5) as
  new tests. Optionally clarify the old titles to "deck and discard empty" so a
  reader doesn't misread them as covering the reshuffle case.

## Required `// why:` Comments
- `reshuffleDiscardIntoDeck`: why the reshuffled discard is APPENDED after the
  current deck (retains already-peeked cards left on top), and why the empty-discard
  case is a no-op (terminates the reveal/scry).
- `heroEffectReveal` reshuffle site: cite D-24285 superseding D-21502 **for this
  handler** (this replaces the old `no reshuffle, D-21502` comment) — reveal
  reshuffles on exhaustion per the Legendary rule + the `drawCardsIntoHand`
  precedent. The supersession is SCOPED — the D-24200 reveal-eight strike keeps
  its no-top-up on its own rationale.
- `villainEffectScryKoOwnDeck` reshuffle site: cite D-24285 superseding the WP-447
  scry no-reshuffle stance; why top-up runs before the 0/1/≥2 branch.
- `executeVillainAbilities` new param + each caller: why `random` is threaded (the
  scry reshuffle needs `ctx.random.Shuffle`; bare bgio `ctx` carries no `random`).

## Files to Produce
- `packages/game-engine/src/moves/drawCards.logic.ts` — **modified** — export `reshuffleDiscardIntoDeck`.
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — **modified** — helper unit tests (append ordering; empty-discard no-op; deterministic fake `Shuffle`).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — reveal peek loop reshuffles via the helper (ctx→`ShuffleProvider`).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — empty-deck reveal reshuffle across the family + `reveal-count` top-up.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — `executeVillainAbilities` param + scry top-up reshuffle.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — empty/short-deck scry reshuffle; callers pass a shuffle context.
- `packages/game-engine/src/moves/fightVillain.ts` — **modified (runtime wiring, `01.5`)** — pass `random` to the executor.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified (runtime wiring, `01.5`)** — pass `random` at the onEscape + onAmbush calls.
- `packages/game-engine/src/setup/extIdReconciliation.e2e.test.ts` — **modified (test caller)** — its `executeVillainAbilities(…, 'onAmbush')` call (~line 358) needs the new stub `shuffleContext` arg (`{ random: { Shuffle: (deck) => deck } }`); CI won't catch the stale 4-arg call (engine tests aren't typechecked), so fix it by hand.
- **Conditional (determinism):** record-game / replay fixture + pinned `finalStateHash` if a fixture hits the path (regenerate-with-note).

## After Completing
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0.
- [ ] Reveal-family + scry regression sets byte-identical on the non-empty-deck path.
- [ ] Replay/fixture `finalStateHash` unchanged OR regenerated via `node scripts/record-game-fixture.mjs` with a note (Verification Step 4); no sentinel re-pin. (The only replay fixture at draft, `sentinel-core-doom-2p.replay.json`, hits no reveal/scry path — expect no regen, but confirm empirically.)
- [ ] `docs/ai/DECISIONS.md` — D-24285 landed (Active); D-21502 annotated "Superseded for the hero reveal peek-loop + villain scry handler by D-24285" and naming the retained D-24200 reveal-eight no-top-up carve-out (NOT wholesale Superseded).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] Live-on-surface: drive a match/fixture that reveals (or fights a Doombot) with an empty deck + non-empty discard; the log shows it resolving off the reshuffled deck.

## Common Failure Smells
- An empty-deck reveal still logs nothing → the peek-loop `return` was not gated on the reshuffle (D-21502 no-op left in place).
- A reveal-family test that empties the deck changes hashes unexpectedly on the NON-empty path → the reshuffle branch is being entered when it shouldn't (guard on `peekOffset >= deck.length` wrong).
- `villainEffects.execute.ts` reads `random` off `ctx` → wrong; it isn't there. Thread the new param.
- The reshuffled discard REPLACED the deck (lost cards already left on top) → used full-replace instead of append.
- A determinism/replay test fails and the diff is only a shuffled deck order → expected; regenerate the fixture + re-pin the hash with a note (do not chase it as a bug).
- `drawCardsIntoHand` behavior changed → it was refactored onto the helper (forbidden).
