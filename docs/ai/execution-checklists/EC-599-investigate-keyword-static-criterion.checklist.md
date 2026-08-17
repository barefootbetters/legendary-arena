# EC-599 — `investigate` Keyword (Static Criterion)

**Work Packet:** WP-564
**Layer:** Game Engine + card-data-derived feeds
**Status:** Pending
**Locks:** D-24373

> The WP is the authoritative design document. Where this EC and WP-564
> conflict, the WP wins. This EC extracts the drift-prone values.

---

## Before Starting

- [ ] `git fetch origin main`, branch from a clean tree, record the SHA.
- [ ] Fresh worktree? `pnpm install`, then `pnpm -r build` (the ledger scripts
      import built `dist`).
- [ ] Record the pre-change game-engine test count — it is the AC floor.
- [ ] Read the printed text of all ten in-scope cards in `data/cards/{dims,msmc,noir}.json`
      before writing the parser. **Do not** take the contract from
      `data/metadata/keywords-full.json` — it is a known-divergent source and its
      `investigate` entry is mojibake-corrupted.
- [ ] Read the `reveal` family (WP-253 / D-24024) — you mirror its shape, incl. `revealCount`.

## Locked Values

- Look count **N = 2**, carried as a descriptor field (so the deferred
  look-at-three modifier can set it later without reshaping the effect).
- Selection: **first** card in look order satisfying the criterion. Deterministic.
  **No pending choice.**
- Non-selected looked-at cards → **bottom** of the deck, **look order preserved
  among themselves**.
- `and/or` = **inclusive OR**.
- Criterion vocabulary (static only): `icon` attack / recruit; `cost` exact /
  `or less` / `or more`; `hero-class`; `team`; `and/or` combinations.
- Short deck → reuse `reshuffleDiscardIntoDeck`
  (`packages/game-engine/src/moves/drawCards.logic.ts:109`). **Never a second
  reshuffle path.**
- Canonical-array lockstep: `HeroKeyword` union + `HERO_KEYWORDS` + `MVP_KEYWORDS`
  in `rules/heroKeywords.ts`; parity drift test in `heroAbility.setup.test.ts`.
- The ten in-scope lines: Alias Investigations · Shared Thoughts · Find Tiny
  Friends · Uncover Family Secrets · Discover the Bodies · Private
  Investigations · Gumshoe's Revolver · Mechanized Plate-Mail · X-Factor
  Investigations · Unearth Tectonic Power.

## Guardrails

1. **No pending choice.** The six *Choose a number / Choose a Hero Class /
   Choose recruit or attack* cards are OUT. A parked choice without a `UIState`
   projection and a client prompt hard-freezes the human player — that is a
   safety boundary, not a scope preference.
2. **No other-zone investigate** — Villain Deck, Sidekick Stack, Hero Deck, Bystander Stack, each player's deck.
3. **No `[keyword:Teleport]`.** Unimplemented; `Search Parallel Dimensions` stays
   unsupported.
4. **No disposition or modifier variants** (draw-or-KO, KO-or-discard,
   look-at-three, any-card, three-option chain).
5. **No card-data edit.** Every marker is correctly authored; this is a code gap.
6. **No change to the `reveal` family.** Precedent, not target.
7. **No `ctx.random`** in selection — first-match is deterministic; randomness breaks replay.
8. **No `.reduce()`** over the looked-at cards; use `for...of` with descriptive names.

## Required Comments

- [ ] `// why:` on the look-count descriptor field — that 2 is the printed
      default and the field exists so the deferred look-at-three modifier does
      not reshape the effect.
- [ ] `// why:` on first-match selection — deterministic by design; the
      choose-a-criterion cards are a separate packet precisely because a parked
      choice needs projection + prompt to avoid a client freeze.
- [ ] `// why:` on the bottom-ordering — look order is preserved so replay is
      reproducible.
- [ ] `// why:` on inclusive-OR for `and/or`, citing the printed text.

## Files to Produce

| File | New? |
|---|---|
| `packages/game-engine/src/rules/heroKeywords.ts` | edit |
| `packages/game-engine/src/rules/heroAbility.types.ts` | edit |
| `packages/game-engine/src/setup/heroAbility.setup.ts` | edit |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | edit |
| `packages/game-engine/src/setup/heroAbility.setup.test.ts` | edit |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | edit |
| `data/metadata/card-mechanics.json` | regenerated |
| `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` | regenerated |
| `data/metadata/effect-implementation-index.json` | regenerated |
| `docs/ai/DECISIONS.md` (D-24373) | edit |

Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`.

## After Completing

- [ ] Regenerate **all three** feeds — `mechanics:metadata`, `ledger:heroes`,
      `effect-index` — then re-run every `:check`. A keyword-recognition change
      flips a mechanic's `source` from `free-text` to `keyword`, so a partial
      regeneration reddens `main` for every concurrent session.
- [ ] `pnpm -r build && pnpm -r --no-bail test` green.
- [ ] Confirm in the regenerated ledger that the ten lines left `unsupported`
      **and** that the deferred lines did not silently change status.
- [ ] **Measure** the in-play observation delta (`sim:runtime-observed`) and
      record the actual number. The base covers 10 of 28 lines — do **not** claim
      the 293 headline.
- [ ] Land D-24373; flip WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap `✅`,
      `pnpm roadmap:counts:write`; STATUS.md.
- [ ] Assess `01.6` — a new keyword plus a new criterion vocabulary is likely a
      new code category.
- [ ] **D-24026 live-verify:** play one of the ten Heroes, play the card, read the
      game log.
- [ ] Two-commit topology: `EC-599:` implementation, then `SPEC:` governance close.

## Common Failure Smells

- **Silent zero-match.** Drawing nothing with no log line reads as a broken card.
  Name the criterion in a `blocked`-outcome line (the WP-550 precedent).
- **Bottoming in the wrong order.** A set-equality assertion will pass while
  replay diverges. Assert the ORDER.
- **Exclusive-OR on `and/or`.** A card matching only one clause must still
  qualify; AC-5 pins both directions.
- **A second reshuffle path.** Short-deck handling belongs to the existing helper.
- **Half-regenerating the feeds.** Three go stale here, not one.
- **Scope creep into the choose-first cards.** They look like two more lines of
  parsing and are actually a client-freeze risk.
- **`git status` noise.** `packages/lagn-spec/schemas/lagn-v1.json` shows ` M`
  from line-ending churn; confirm with `git diff --ignore-cr-at-eol --numstat`
  and `git checkout --` it.
