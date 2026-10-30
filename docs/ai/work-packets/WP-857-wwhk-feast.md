# WP-857 — Hero Feast ("You may [keyword:Feast]" — KO the top card of your deck): Miek and No-Name (Game Engine)

**Status:** Draft 2026-10-29 (EC-895; D-24793 reserved)
**Layer:** Game Engine (one handler-bearing hero keyword reusing a shipped handler + a parser allowlist)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-754 / D-24581 (`reveal-top-may-ko`: park a KO-or-keep reveal of the deck top) ✅,
D-24558 (per-entry `isKoAllowed` on `PendingRevealTopDispose`) ✅, WP-702 / D-24521 (the reveal-top
dispose queue, prompt and resolve move) ✅, WP-658 / D-24469 (the per-card allowlist pattern for a
held-back printed keyword, `SUPPORTED_TRANSFORM_BASES`) ✅

## Goal

Make World War Hulk's hero **Feast** do something. "Feast" means "KO the top card of your deck"
(rulebook; `docs/Marvel Legendary Universal Rules v23.txt`), and five Miek / No-Name lines print
"You may [keyword:Feast]". Today the parser does not know the token, so every one of those lines does
nothing. After this WP, each of the five lines lets the player choose whether to KO the top card of
their deck: the deck top is shown in the existing owner-only reveal-top prompt with **KO** and
**Keep** buttons, exactly as Carnage's Gruesome Feast already works.

## User-Visible Impact

`play.legendary-arena.com` — playing Metamorphosis or Bursting with Life, or (when their class gate
holds) Devouring Frenzy ([hc:instinct]) and Appetite for Destruction ([hc:covert]), shows the player the top card of their deck with KO / Keep; KO sends it to the KO pile. With an empty
deck and discard the log says there was no card. Hive King Miek is Metamorphosis's Transform face
(`isTransform`, set aside in `G.transformDeck`, D-24468); it reaches play only through that Transform,
which stays unmodeled, so its Feast is reachable today only by operator staging. Live-on-surface is
operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `5dc5fae8` (the WP-857 reserve merge, #3107); rebased onto `f88c326b` (WP-856 executed) with the anchors and pins (87 / 69) unchanged.
- `hero/heroEffects.execute.ts` (paths under `packages/game-engine/src/`) has
  `heroEffectRevealTopMayKo(G, ctx, playerID, _cardId, _effect)` (WP-754 / D-24581): it reveals the
  deck top (reshuffle-on-empty), parks one `PendingRevealTopDispose` whose entry carries
  `isKoAllowed: true, isDiscardAllowed: false`, and logs "… revealed X from the top of their deck —
  KO it or keep it (reveal-top)"; an empty deck and discard is a logged `blocked` no-op. It is the
  `'reveal-top-may-ko'` entry of `HERO_EFFECT_HANDLERS`, listed in `HANDLED_KEYWORDS` and
  `NO_MAGNITUDE_KEYWORDS`.
- `moves/revealTopDispose.resolve.ts` resolves the front entry: `'ko'` KOs the card (and calls the
  owned-KO recorder, a deck site), `'top'` keeps it; after each shift `refreshStaleKoOrKeepFront`
  re-reveals a stale KO-or-keep front, so a queued prompt always shows the current top.
- `apps/arena-client/src/components/play/PendingRevealTopDisposePrompt.vue` renders the prompt only
  for the owner and shows a KO button for an `isKoAllowed` entry. The bot / sim default already
  resolves this queue (WP-754).
- `setup/heroAbility.setup.ts`: a printed `[keyword:X]` whose name is not a HeroKeyword falls to the
  generic `unresolvedMarkers.push` branch; the `transform` arm (checked BEFORE `isValidHeroKeyword`)
  pushes the keyword only for a `SUPPORTED_TRANSFORM_BASES` card and records an unresolved marker
  otherwise (the Honest-Partial Invariant).
- `scripts/hero-mechanic-ledger.mjs` `BY_HOOK_KEYWORDS` classifies a listed keyword per card by what
  the card's hook resolved, not by name.
- The hero keyword lockstep sites and current pins (observed at `0eebc7b5`): `HeroKeyword` union +
  `HERO_KEYWORDS` (`rules/heroKeywords.ts`) with three length pins at **87**
  (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` incl. its ordered
  `expectedKeywords` array, `setup/heroAbility.setup.test.ts`); `HERO_EFFECT_HANDLERS` with two count
  pins at **69** (`hero/heroEffects.execute.test.ts`); `HANDLED_KEYWORDS`; `NO_MAGNITUDE_KEYWORDS`.
  These literals go stale if another keyword WP lands first: read them at HEAD.

## Context (Read First)

- **Parse today (observed 2026-10-29, probe of `buildHeroAbilityHooks` on `data/cards/wwhk.json`).**
  Every printed `[keyword:Feast]` lands in `unresolvedMarkers`:
  - `wwhk/miek-the-unhived/devouring-frenzy` line 1 "[hc:instinct]: You may [keyword:Feast]." →
    `conditions: [heroClassMatch instinct]`, `unresolvedMarkers: [feast]`, no effect.
  - `wwhk/miek-the-unhived/metamorphosis` "You may [keyword:Feast]. Then, if a card with an
    [icon:attack] icon was KO'd from your deck this turn, [keyword:Transform] this into Hive King
    Miek." → `unresolvedMarkers: [feast, transform]` plus a magnitude-less `attack` effect leaked
    from the descriptive icon (dropped at runtime by the magnitude pre-gate).
  - `wwhk/miek-the-unhived/hive-king-miek` "Look at the top three cards of your deck and put them back
    in any order. Then you may [keyword:Feast]." → `unresolvedMarkers: [feast]`.
  - `wwhk/no-name-brood-queen/appetite-for-destruction` line 1 "[hc:covert]: You may
    [keyword:Feast]." → `heroClassMatch covert`, `unresolvedMarkers: [feast]` (line 0, its
    discard-or-put-back reveal, is already `reveal-top-dispose`, WP-702).
  - `wwhk/no-name-brood-queen/bursting-with-life` "You may [keyword:Feast]. Then, if a non-grey Hero
    was KO'd from your deck this turn, [keyword:Transform] this into Torrent of Broodlings." →
    `unresolvedMarkers: [feast, transform]`.
  - Not in scope: `wwhk/no-name-brood-queen/world-spanning-hunger` ("Look at the top card of your
    deck. Then [keyword:Feast] up to three times. You get +2[icon:attack] for each non-grey Hero that
    was KO'd from your deck this turn.") parses to `unresolvedMarkers: [feast]` and a flat
    `attack:2` — a **live phantom +2 Attack on every play**; and `wwhk/sentry/the-void-unchained`
    ("Reveal the top card … If it costs 0, then [keyword:Feast]. Otherwise, [keyword:Transform] …")
    needs Sentry's unmodeled Transform-to-discard.
- **Why reuse `reveal-top-may-ko`.** Feast on a hero line is "you may KO the top card of your deck",
  which is exactly the shipped KO-or-keep reveal (Gruesome Feast, Remove His Spine, Electroshock
  Therapy). A new `feast` keyword whose `HERO_EFFECT_HANDLERS` entry is the same
  `heroEffectRevealTopMayKo` function gives the printed keyword its own ledger name and handler entry
  with no new handler code, queue, move, prompt or `G` field. Probe (survey 2026-10-29): three parks in
  one play give three sequential prompts that each show the current top (KO a, keep b, KO b), so the
  same handler also serves a future "Feast up to three times".
- **Fidelity fork (RS-1).** The rulebook's Feast is a KO of the top card with no look first. Reusing
  the handler shows the player the card before the choice. That is faithful on Hive King Miek (it just
  looked at the top three), and on Devouring Frenzy / Appetite for Destruction, whose other line looks
  at or reveals the top card first (except after an Appetite line-0 discard, when the Feast shows a
  fresh top); on Metamorphosis and Bursting with Life the player learns one card they would not have
  seen. The prompt is owner-only; the reveal and keep log lines name the card publicly. A
  blind confirm would need a per-entry flag, a different prompt and log text — a client change for an
  informational delta in a co-op game.
- **Why an allowlist (`FEAST_CARDS`).** Once `feast` is a HeroKeyword the generic push would also
  resolve it on World-Spanning Hunger (feasting once and keeping the phantom +2 while "up to three
  times" and the per-Hero bonus stay unmodeled) and on The Void Unchained (feasting unconditionally,
  dropping its cost check and Transform branch). Recognizing the token only on the five fully covered
  lines keeps every other Feast line an honest unresolved marker (the Honest-Partial Invariant,
  `SUPPORTED_TRANSFORM_BASES` / `X_GENE_CARDS` precedent).
- **Transform halves stay as they are.** Metamorphosis and Bursting with Life put the Feast and a
  conditional Transform on one printed line, and today a condition gates a whole line's hook. This WP
  adds no condition, so the Feast fires unconditionally and the `transform` marker stays unresolved
  (unchanged). Gating the Transform needs a per-turn record of which cards left each deck to the KO
  pile (the recorder's `cardId` + `fromZone` from WP-855 / WP-856), a one-line-to-two-hooks parse
  split, two new conditions and a `SUPPORTED_TRANSFORM_BASES` entry each — the follow-up WP below,
  together with World-Spanning Hunger and its phantom +2.
- **Hive King Miek is not reachable in play yet.** It carries `transformOf: "metamorphosis"` and is set
  aside in `G.transformDeck` at setup; it enters play only through Metamorphosis's Transform. It stays
  in `FEAST_CARDS` because its Feast line is correct for when that Transform is modeled. Its first half
  ("look at the top three ... put them back in any order") has no marker, so once `feast` resolves the
  hook reads as fully resolved with that half silently dropped — accepted (the Feast prompt shows the top
  card; the reorder is a separate data change).
- **Coverage signal.** Once `feast` is a HeroKeyword, `scripts/hero-effect-coverage.mjs` stops
  counting it in `unsupportedMechanics` on all seven Feast lines, World-Spanning Hunger and The Void
  Unchained included (the same posture as `transform`; warn-only). Their honest gap is carried by each
  hook's unresolved `feast` marker (hollow detection, runtime-observed hollows). Its baseline entry
  (`"feast": 7` in `scripts/coverage/hero-effect-coverage.baseline.json`) drops at
  `sim:coverage --update-baseline`.
- **Other halves out.** Devouring Frenzy line 0 ("Look at the top card … put it back on the top or
  bottom") has no engine mechanism (no deck-bottom placement); Hive King Miek's "look at the top three
  and put them back in any order" could ride the existing reveal + reorder markers but is a separate
  data change. Neither changes what the Feast line does.
- **Villain / Mastermind Feast is a different surface.** `[keyword:Feast]` also appears on Maximum
  Carnage (pttr) and World War Hulk villains, henchmen and masterminds ("Fight: KO the top card of
  your deck"); those go through the villain ability path, not `HERO_KEYWORDS`, and stay out.
- **Synergy.** A Feast KO goes through the reveal-top resolve, an owned deck KO site, so it feeds
  Absorb Energies (WP-853) and, once WP-855 executes, Endless Appetite's per-KO draw.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline + Principle #1 (determinism).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`).
- `docs/ai/DECISIONS.md` — scan D-24581, D-24558, D-24521, D-24469, D-24045 (Honest-Partial / by-hook
  ledger), D-24372 before coding. Auto-memory `reference_hero_keyword_lockstep_sites` (six sites).
- `docs/ai/REFERENCE/00.6-code-style.md` — the code-style rules every file follows.

### RS-1 — Reveal before the choice (operator ruling, default locked)

Default locked: reuse the shipped reveal-top-may-ko prompt (the card is shown, then KO / Keep). What
the players see, unchanged by this WP:

- Prompt heading (owner only, `PendingRevealTopDisposePrompt.vue`): "Reveal the top card — KO it or
  keep it"; hint: "A card you keep stays face-up on top of that player's deck." Feast is not named.
- Park log (every seat, `heroEffectRevealTopMayKo`): "Player N revealed <card> from the top of their
  deck — KO it or keep it (reveal-top)."
- Keep log (every seat, `resolveRevealTopDispose`): "Player N kept <card> (<id>) on top of Player N's
  deck (reveal-top)."

So the card name is public on both logs. On Appetite for Destruction a line-0 discard re-reveals a
fresh top for the Feast prompt — one card the player had not looked at. If Jeff rules that a blind or
Feast-worded prompt is required, that is a per-entry flag plus prompt and log changes (engine +
client); this WP stops and is redrafted. Confirm at the execution go.

## Scope (In)

- **Keyword.** `'feast'` joins the `HeroKeyword` union and the end of `HERO_KEYWORDS`
  (`rules/heroKeywords.ts`) with a `// why:` naming WP-857 / D-24793 and the shared handler. No
  magnitude.
- **Handler.** `HERO_EFFECT_HANDLERS` gains `feast: heroEffectRevealTopMayKo` (the existing function,
  unchanged); `'feast'` joins `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`.
- **Parser.** `const FEAST_CARDS: ReadonlySet<string>` in `setup/heroAbility.setup.ts`, keyed
  `{setAbbr}/{heroSlug}/{cardSlug}`, exactly: `wwhk/miek-the-unhived/devouring-frenzy`,
  `wwhk/miek-the-unhived/metamorphosis`, `wwhk/miek-the-unhived/hive-king-miek`,
  `wwhk/no-name-brood-queen/appetite-for-destruction`, `wwhk/no-name-brood-queen/bursting-with-life`.
  `parseAbilityText`'s options gain `feastSupported?: boolean`, resolved at its call site as
  `FEAST_CARDS.has(<canonical key>)` beside `transformSupported`. A `normalizedKeyword === 'feast'` arm,
  placed with the `transform` arm (before `isValidHeroKeyword`), does `keywords.push('feast')` when
  `feastSupported`, else `unresolvedMarkers.push('feast')`. No effect-builder edit: like `transform`, the
  keyword falls through to its final `effects.push({ type: keyword })`.
- **Ledger.** `scripts/hero-mechanic-ledger.mjs` `BY_HOOK_KEYWORDS` gains `'feast'`. Rows are per hero +
  mechanic (the resolved set is unioned over the hero's deck), so after this WP the
  `wwhk/miek-the-unhived|feast` and `wwhk/no-name-brood-queen|feast` rows read `executable` (No-Name's
  card list still names World-Spanning Hunger) and `wwhk/sentry|feast` stays `unsupported`. World-Spanning
  Hunger's remaining gap is carried by its hook's unresolved `feast` marker, not by a ledger row.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`,
  `sim:coverage --update-baseline`, the dashboard in-play pin if it moves; a `mechanic-provenance.json`
  row for `feast`; pending `live-verify.json` rows keyed `wwhk/miek-the-unhived|feast` and
  `wwhk/no-name-brood-queen|feast` (the WP-853 row shape).
- **Tests.** New `hero/feast.test.ts`, **+8** cases, hooks built by the setup parser from the
  committed `wwhk.json`: (1) parse — each of the 5 cards' Feast line carries the `feast` keyword and a
  `{ type: 'feast' }` effect with no `feast` in `unresolvedMarkers`, Devouring Frenzy / Appetite for
  Destruction keeping their `heroClassMatch` gate; (2) World-Spanning Hunger and The Void Unchained
  still record `feast` in `unresolvedMarkers` and carry no `feast` keyword; (3) playing Metamorphosis
  parks one `PendingRevealTopDispose` whose single entry is the deck top with `isKoAllowed: true` and
  `isDiscardAllowed: false`; (4) resolving it `'ko'` moves that card from the deck to `G.ko`;
  (5) resolving `'top'` leaves the deck unchanged and clears the queue; (6) Devouring Frenzy with no
  other Instinct card in play parks nothing (gate blocked); (7) Appetite for Destruction with a Covert
  card in play parks the line-0 discard-or-keep entry then the Feast entry, and after discarding the
  top the Feast prompt shows the new top (`refreshStaleKoOrKeepFront`); (8) empty deck and discard →
  no park, a `blocked` log line. Pins bumped in place (no new case): the three `HERO_KEYWORDS` length
  pins 87 → 88 (and `'feast'` appended to `expectedKeywords`), the two `HERO_EFFECT_HANDLERS` pins
  69 → 70 with their messages naming WP-857 / D-24793. Expected engine delta **+8**, one new `describe`
  (pre-flight observed baseline 6075 tests -> 6083; no per-keyword loop generates cases).

## Out of Scope

- **Follow-up WP (Feast readers):** the per-turn "KO'd from your deck this turn" record (after WP-855
  and WP-856 execute), the Metamorphosis / Bursting with Life parse split + two conditions +
  `SUPPORTED_TRANSFORM_BASES`, World-Spanning Hunger ("up to three times", +2 per non-grey Hero, and
  its live phantom +2).
- The Void Unchained and the rest of Sentry's Transform family.
- A blind Feast prompt (RS-1 default: reuse the reveal prompt).
- Devouring Frenzy's "top or bottom" look and Hive King Miek's look-and-reorder halves.
- Villain, henchman and Mastermind Feast (pttr Maximum Carnage, wwhk).
- Any new handler body, pending queue, move, `CORE_MOVE_NAMES` entry, `G` field, UIState field or client
  change; any card-data change.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `'feast'` in the union + array.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `HERO_EFFECT_HANDLERS`,
  `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` entries.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `FEAST_CARDS` + the `feast` arm.
- `scripts/hero-mechanic-ledger.mjs` — **modified** — `BY_HOOK_KEYWORDS` entry.
- Tests: `packages/game-engine/src/hero/feast.test.ts` — **new**; `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`,
  `hero/heroEffects.execute.test.ts` — **modified** (pins only).
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json`,
  `apps/dashboard/src/data/*` coverage copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24793),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets, no "changed section
  only" output; ESM only; Node v22+; human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness added (the reveal's reshuffle-on-empty uses the existing `ctx.random`
  path); no `Math.random()`, clocks or I/O; moves never throw.
- No new `G` field; the Feast uses the existing `pendingRevealTopDispose` queue only in games that play
  one of the five cards, so the `finalStateHash` sentinels (none uses wwhk) are byte-identical — **no
  re-pin**. If a sentinel moves, STOP.
- `heroEffectRevealTopMayKo` is reused unchanged; no per-card special-casing in it.
- No card data change; `cards:check` stays green untouched.
- Pins are RUNTIME assertions (D-24372); a pin is bumped only for the added keyword / handler.

**Session protocol:** if a covered card still records `feast` as unresolved, World-Spanning Hunger or
The Void Unchained gains the `feast` keyword, or playing a covered card parks nothing (the
`NO_MAGNITUDE_KEYWORDS` miss — the handler is registered but never reached), STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HeroKeyword` gains `'feast'` (no magnitude); `HERO_EFFECT_HANDLERS.feast === heroEffectRevealTopMayKo`.
- `FEAST_CARDS` = the five card keys above; a printed `[keyword:Feast]` resolves only on them.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10,
§22 (Deterministic & Reproducible Evaluation).
- **No conflict:** five printed abilities that do nothing today resolve as printed (with the RS-1
  reveal-before-choose delta on two of them).
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — printed hero abilities, nothing bought.
- **Determinism preservation:** no new randomness source or `G` field; the existing queue and its
  resolve are reused; no sentinel uses wwhk. **Setup-only:** a replay starts from the stored
  `initialState`, which already holds `G.heroAbilityHooks` (`apps/server/src/replay/matchReplay.logic.ts`),
  and no pre-deploy hook carries a `feast` effect, so pre-deploy matches keep their hooks and replay
  identically; only matches created after the deploy get Feast (the D-24563 §5 / D-24749 §12 posture).

## Funding Surface Gate

N/A — no UI, copy, nav or funding surface; hero abilities' engine behaviour and the existing prompt.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Each of the five `FEAST_CARDS` Feast lines parses to the `feast` keyword + effect, with no `feast`
   unresolved marker; the class gates on Devouring Frenzy and Appetite for Destruction are kept.
2. World-Spanning Hunger and The Void Unchained still record `feast` unresolved and carry no `feast`
   keyword.
3. Playing a covered card (gate held) parks one KO-or-keep reveal of the deck top; KO moves it to the
   KO pile, Keep leaves the deck unchanged.
4. A blocked class gate parks nothing; an empty deck and discard is a logged no-op.
5. With two reveal-top entries queued, the Feast prompt shows the current top after the first resolves.
6. `HERO_KEYWORDS` and `HERO_EFFECT_HANDLERS` pins move by exactly one each; `HANDLED_KEYWORDS` /
   handler parity test passes; `'feast'` is in `NO_MAGNITUDE_KEYWORDS`.
7. The ledger reads `feast` `executable` on the Miek and No-Name rows and `unsupported` on the Sentry
   row; the World-Spanning Hunger and The Void Unchained hooks keep their unresolved `feast` marker;
   every feed `:check` exits 0.
8. Engine suite green at baseline +8 (6075 -> 6083 at `5dc5fae8`);
   `pnpm -r build` 0; `finalStateHash` sentinels unchanged with no pin literal edited;
   `cards:check` green with no card-data change.

## Verification Steps

Regenerate (in order, after the engine change builds):

- First add the `feast` row to `scripts/coverage/mechanic-provenance.json` and the two pending
  `live-verify.json` rows.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage`
  — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green; every `finalStateHash` / sentinel assert
  (`game.test.ts`, `simulation/*Parity.test.ts`, `test/fixtures/replayFixtures.test.ts`,
  `test/fixtures/hashGameState.test.ts`, `simulation/seatChoiceDispatch.test.ts`,
  `simulation/simulation.captureMoves.test.ts`) passes with no pin literal edited.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match with Miek and No-Name, created after the deploy, plays
      Metamorphosis (or Bursting with Life) and KOs the top card through the Feast prompt, and keeps it on another play —
      confirmed live, or left open as operator-pending in `docs/ai/STATUS.md` with the pending
      `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24793 → Active;
      `docs/ai/work-packets/WORK_INDEX.md` checked; `docs/ai/execution-checklists/EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only
      origin/main...HEAD` checked against that list.

## Reserved Decision (lands at execution)

D-24793 — The World War Hulk hero keyword Feast ("KO the top card of your deck", printed "You may
[keyword:Feast]") is the `feast` HeroKeyword, whose handler is the shipped `heroEffectRevealTopMayKo`
(D-24581): the deck top is shown in the owner-only KO-or-keep prompt and the player KOs or keeps it.
Showing the card before the choice is accepted (RS-1) — it matches the printed look on three of the
five lines and costs one card of information on Metamorphosis and Bursting with Life, and on Appetite
for Destruction after a line-0 discard. The token
resolves only on the `FEAST_CARDS` allowlist (Devouring Frenzy, Metamorphosis, Hive King Miek,
Appetite for Destruction, Bursting with Life — Hive King Miek is a Transform face, reachable once
Metamorphosis's Transform is modeled; its look-and-reorder half is accepted as dropped); World-Spanning
Hunger and The Void Unchained keep an honest unresolved marker until their other text is modeled
(Honest-Partial Invariant). `feast` is a by-hook ledger keyword; rows are per hero, so the Miek and
No-Name rows read executable and the gap rides on the hooks' unresolved markers. Setup-only:
pre-deploy matches keep their hooks and replay identically; only matches created after the deploy get
Feast. The player sees the shared reveal-top text (quoted in RS-1), and the card name is public in the
reveal and keep log lines. Villain / Mastermind Feast is a separate surface. No new `G` field.
Follow-up: the per-turn KO'd-from-deck record, the two Transform gates and World-Spanning Hunger.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent, prototype + full suite):** NOT READY — PS-1: the ledger
  groups rows per hero, so No-Name's row reads executable with World-Spanning Hunger in its list -> AC-7,
  Scope, EC and D-24793 reworded. PS-2: Hive King Miek is Metamorphosis's Transform face, unreachable in
  play today -> impact and live-verify path corrected, kept on the allowlist. RS-1 parser option made
  concrete (`feastSupported`, no effect-builder edit); RS-2 coverage signal noted; RS-3 Hive King Miek's
  dropped reorder half stated; RS-4 counts locked (6075 -> 6083, one `describe`); RS-5 rebase order with
  WP-855 (EC reads pins at HEAD). Verified by prototype: all 7 parse claims, the dispatch path, arm
  placement, villain Feast unaffected, every test case, exactly 5 pin failures and no sentinel movement.
  Both fixes are text-only, no scope change: **READY TO EXECUTE**.
- **Copilot round 1 (independent subagent, re-probed the parse):** RISK -> HOLD, three text-only fixes,
  all folded: (1) the replay claim was backwards — the change is setup-only (hooks live in
  `initialState`), so pre-deploy matches replay identically; Vision, D-24793 and the DoD (match created
  after the deploy) corrected; (2) RS-1 now quotes the real prompt and log strings, the public card name
  and the Appetite discard path; (3) the coverage script path corrected and the NUMBER-LEDGER
  reservation text narrowed to this scope. Verified: Hive King Miek handling, Appetite / Absorb /
  Endless Appetite interplay, bot / sim defaults, the five pins, arm placement, the magnitude gate,
  file lists and counts.
- **Copilot round 2:** RISK -> HOLD on one residual drift (the Context fidelity paragraph and D-24793
  had not taken RS-1's Appetite discard path and keep log) -> fixed in place; F1-F3 and the WP-855
  setup-only correction verified. Disposition after the fix: **CONFIRM** (pre-flight READY stands).

## Lint Gate Self-Review (00.3)

- **§1 structure:** all template sections present; Out of Scope names the readers follow-up, World-Spanning
  Hunger, The Void Unchained, a blind prompt, the other card halves, villain Feast. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited;
  packet-specific (no new `G` field, handler reused unchanged, no card data); session protocol; locked
  values → EC. **PASS.**
- **§3 Assumes:** the reused handler, queue, resolve, prompt and bot default; the transform arm pattern;
  `BY_HOOK_KEYWORDS`; the lockstep sites with their pin values; baseline. **PASS.**
- **§4 Context:** observed parse of all seven lines, the reuse rationale + probe, RS-1, the allowlist
  rationale, the Transform split, Hive King Miek, coverage signal, villain Feast, ARCHITECTURE, 00.2 §5 /
  §5.1, the DECISIONS scan list, the lockstep memory, 00.6. **PASS.**
- **§5 files:** 4 source / script files + 5 test files + generated feeds, each with its role. **PASS.**
- **§6 naming:** `feast` matches the printed keyword; `FEAST_CARDS`, `feastSupported` follow the
  `SUPPORTED_TRANSFORM_BASES` / `transformSupported` names; no 00.2 field touched. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency; engine only; no registry import in the engine; no `G`
  field; no randomness beyond the reused reshuffle path. **PASS.**
- **§9:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, hooks parsed from committed data, no `boardgame.io` import, no
  network / DB; no deck-construction change (golden test N/A). **PASS.**
- **§13 verification:** exact commands with expected exits; the observed baseline 6075 → 6083. **PASS.**
- **§14:** 8 binary, observable criteria tied to names and values. **PASS.**
- **§15 / §15.1:** DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX, the scope-boundary diff check and
  a D-24026 live-on-surface item on a match created after the deploy. **PASS.**
- **§16 code style:** no new function (the handler is reused); one allowlist set and one parser arm in the
  existing transform shape; no `.reduce()`, no nested ternaries; `// why:` locations locked in the EC; no
  thrown errors added. **PASS.**
- **§17 Vision:** §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line (setup-only). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** commit-time rule. **N/A.** Contract
  files: `rules/heroKeywords.ts` gains one union member + array entry, covered by D-24793.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A. **PASS.**
