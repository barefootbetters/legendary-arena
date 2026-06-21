# WP-273 — Wall-Crawl: onRecruit Keyword + Optional Recruit-to-Deck Placement

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24049.
> **Paired EC:** EC-304.
> **Depends on:** WP-021 / WP-022 (hero ability hook pipeline + `executeHeroEffects`),
> WP-016 / WP-135 (the `recruitHero` move + HQ refill), WP-253 (the hero ledger's
> `executable | deferred | unsupported | unmarked` classification + `MVP_KEYWORDS`),
> WP-257 (`parse-unrecognized` hollow detection), WP-259 / WP-265 (the runtime-observed
> sweep that ranks in-play hollows) — all landed.

---

## Goal

After this session, the printed hero keyword **Wall-Crawl** — *"When you recruit
this Hero, you may put it on top of your deck"* (keyword glossary, `data/metadata/
keywords-full.json`) — executes as written. Today `[keyword:Wall-Crawl]` is an
**unrecognized** marker: the parser does not know it, so it defaults to `onPlay`
timing and fires a `parse-unrecognized` hollow every time a wall-crawl hero is
played. The runtime-observed sweep ranks it the **2nd-highest in-play hollow (23
observations)**, across **14 heroes / 29 card lines** (Spider sets: Symbiote
Spider-Man, Black Cat, Moon Knight, Spider-Woman, …). This WP makes `wall-crawl`
a **recognized `HeroKeyword` with an `onRecruit` default timing**, and gives the
`recruitHero` move an **optional placement**: when a wall-crawl hero is recruited,
the recruiting player may route it to the **top of their own deck** instead of the
discard pile (the default). The keyword flips from `unsupported` → `executable` in
the hero mechanic ledger, and the 23 `onPlay` hollows disappear from the
runtime-observed sweep.

**Execution invariant (zone state).** A recruited wall-crawl hero's *zone
placement* differs from today only when `toTopOfDeck === true` — the card then
occupies the next-draw position (`deck[0]`, confirmed against `drawFromPlayerDeck`)
of the recruiting player's own deck immediately after the move resolves; in every
other case it lands in `discard` byte-identically to today. The *diagnostic*
difference is separate and always-on: because the keyword is now recruit-timed and
recognized, **playing** a wall-crawl hero stops firing the `onPlay`
`parse-unrecognized` hollow regardless of `toTopOfDeck` (that arg exists only at
recruit time). Keeping these two differences distinct is what preserves determinism —
see Non-Negotiable Constraints.

**Why this keyword first.** It is the cleanest high-impact target the runtime
sweep names: orthogonal (no coupling to the dodge / undercover / unleash ecosystem
on the Black Widow deck), self-contained (no new zone-state model, no pending-choice
board-freeze machinery), and it builds the **first `onRecruit` execution path** —
reusable by any future recruit-time keyword. It is modeled as an **additive
optional arg to the existing `recruitHero` move**, so there is no new move and no
move-registration drift.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` @ `04c36ba2`
> (post WP-271 / EC-303 #425 + the WP-270 mindmap orphan flip #426 + the concurrent
> EC-142 wiki merges). Supersession check (slug grep `--all -i "wall-crawl"`,
> `WORK_INDEX` / `EC_INDEX` scan, `ls *wall*`) returned no collision — no wall-crawl
> mechanism exists; the only grep hit is a false positive in a WP-265 commit body.
> Next-free numbers confirmed: WP-273, EC-304, D-24049.

- **WP-021 / WP-022 complete.** `setup/heroAbility.setup.ts` parses `[keyword:X]`
  markers into `HeroAbilityHook`s with a `timing` (default `onPlay`, `[timing:X]`
  overrides); `hero/heroEffects.execute.ts::executeHeroEffects` runs from `playCard`
  and dispatches recognized effects via `HERO_EFFECT_HANDLERS` gated on `MVP_KEYWORDS`;
  an unrecognized `[keyword:X]` lands in `unresolvedMarkers` and fires a
  `parse-unrecognized` hollow.
- **`executeHeroEffects` visits ALL of a played card's hooks — it does NOT filter by
  timing.** `coreMoves.impl.ts:155` calls `executeHeroEffects(G, ctx, playerID, cardId)`
  with no timing filter; internally it runs `getHooksForCard(G.heroAbilityHooks, cardId)`
  (a **2-arg** query — there is NO timing parameter) and processes every hook for that
  card, then runs `detectHollowHeroHook` on each. So a recruit-timed wall-crawl hook IS
  visited at play time, and the parser auto-emits an `effects: [{ type: 'wall-crawl' }]`
  descriptor (no magnitude) for the recognized keyword. The design relies on that
  play-time visit being a benign, not-hollow no-op — see the onRecruit Execution Model
  §2/§5. (This corrects the loose "executeHeroEffects fires only onPlay hooks" shorthand.)
- **`onRecruit` timing exists but fires nowhere.** `rules/heroKeywords.ts`
  declares `'onRecruit'` in `HeroAbilityTiming` + `HERO_ABILITY_TIMINGS`, but **no
  code executes a hook at recruit time** — `moves/recruitHero.ts` unconditionally
  pushes the recruited card to `playerZones[pid].discard` (line ~86) and runs no
  hero effects. This WP adds the first `onRecruit` execution.
- **WP-253 complete.** The hero ledger classifies a mechanic `executable` iff its
  name ∈ `MVP_KEYWORDS`, else `deferred` (∈ `HERO_KEYWORDS`) or `unsupported`
  (∉ `HERO_KEYWORDS`). `wall-crawl` is currently `unsupported` (not in the union).
- **WP-257 complete.** `detectHollowHeroHook` emits a `parse-unrecognized` hollow
  for an `unresolvedMarkers` token; the hollow is recorded at the hook's `timing`.
  `wall-crawl` records at `onPlay` today (its default timing while unrecognized).
- **The card data already carries the markers.** All 29 `[keyword:Wall-Crawl]`
  lines exist in `data/cards/**` today (authored by prior sets). **This WP adds NO
  card-data marker and re-marks nothing** — it only makes the parser recognize the
  existing token.
- `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` +
  `pnpm sim:coverage --check` + `pnpm ledger:heroes:check` +
  `pnpm sim:runtime-observed:check` + `pnpm mechanics:metadata:check` all exit 0 on
  the base.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a line:

- `docs/ai/ARCHITECTURE.md §The Move Validation Contract` + §Phase & Turn
  Transitions — the recruit move stays validate-args → stage/pending gate →
  mutate-via-helpers → return-void; moves never throw.
- `packages/game-engine/src/moves/recruitHero.ts` — the move this WP extends; the
  card is placed at line ~86. The `toTopOfDeck` arg + the onRecruit-hook check are
  added here.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the marker parser; the
  timing-default assignment (default `onPlay`, `[timing:X]` override) is where the
  keyword→`onRecruit` default is added.
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` /
  `HeroAbilityTiming` closed unions + canonical arrays (drift-detected).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `MVP_KEYWORDS`, the
  `onPlay` dispatch, `detectHollowHeroHook` / `classifyHeroEffectReason`, and
  `getHooksForCard` (the per-card hook query the recruit move reuses).
- `packages/game-engine/src/rules/villainAbility.types.ts::getVillainHooksForCard`
  + WP-271's `buildVillainAbilityHooks` are the **structural precedent** for a
  per-card hook query at a non-`onPlay` timing.
- `data/metadata/keywords-full.json` — the authoritative Wall-Crawl rules text.
- `docs/ai/DECISIONS.md` — D-24024 (the hero ledger `MVP_KEYWORDS` classification),
  D-24034 (`unresolvedMarkers`), D-24044/D-24045 (the by-hook ledger discipline)
  before reserving D-24049.
- `.claude/rules/code-style.md` + `00.6` + `.claude/skills/legendary-game-engine/SKILL.md`.

---

## The onRecruit Execution Model (locked design — D-24049)

1. **`wall-crawl` becomes a recognized `HeroKeyword`** (union + canonical array +
   the drift test). The parser recognizes `[keyword:Wall-Crawl]` (case-insensitively
   normalized to `wall-crawl`, the same normalization the ledger's
   `normalizeMechanicToken` already applies), so it no longer lands in
   `unresolvedMarkers` and no longer fires an `onPlay` `parse-unrecognized` hollow.
2. **`wall-crawl` defaults to `onRecruit` timing**, via a new keyword→default-timing
   mechanism in the parser (a small `KEYWORD_TIMING_DEFAULTS` map; absent from the
   map ⇒ the existing `onPlay` default; an explicit `[timing:X]` marker still
   overrides). Playing a wall-crawl hero produces **no onPlay effect** — but NOT
   because `executeHeroEffects` skips the hook. `executeHeroEffects` does NOT filter by
   timing; it visits the recruit-timed hook at play time and its auto-emitted
   `{ type: 'wall-crawl' }` effect reaches `executeSingleEffect`, which **no-ops on the
   missing magnitude** (`[keyword:Wall-Crawl]` carries no `:N`), so no onPlay state
   changes. The hollow side is handled by §5.
3. **The effect is an optional placement at recruit time.** `recruitHero` gains an
   additive optional arg `toTopOfDeck?: boolean`. After the stage/pending gates,
   the move checks whether the recruited card has an `onRecruit` `wall-crawl` hook
   (via `getHooksForCard(G.heroAbilityHooks, cardId, 'onRecruit')`); if it does
   **and** `toTopOfDeck === true`, the card is placed on **top of the recruiting
   player's own deck** (the next-draw position) instead of the discard pile. Any
   other case (no wall-crawl hook, or `toTopOfDeck` falsy) keeps the existing
   discard placement byte-for-byte.
4. **No pending-choice, no board-freeze, no new move.** The choice is bundled into
   the recruit action itself (the recruiting player's own action, their own deck, no
   hidden information, no opponent interaction) — so this WP needs **none** of the
   WP-242 / WP-248 distributed block-all-guard machinery, and the move-registration
   drift test (`game.test.ts`) is **unchanged** (no new move).
5. **`wall-crawl` is `executable`, and `MVP_KEYWORDS` membership is load-bearing — not
   just a ledger signal.** It is added to `MVP_KEYWORDS` for two reasons. (a) The hero
   ledger classifies a member `executable`. (b) `classifyHeroEffectReason` (the hollow
   detector's reachability check) returns `applied` for any `MVP_KEYWORDS` member, so
   when `detectHollowHeroHook` runs over the play-time-visited wall-crawl hook it
   classifies it **not hollow**. WITHOUT the `MVP_KEYWORDS` add, the now-recognized
   `wall-crawl` keyword would classify `no-handler` (a valid `HeroKeyword` with no
   `HERO_EFFECT_HANDLERS` entry) and `detectHollowHeroHook` would fire a NEW
   `no-handler` hollow at `onPlay` timing — trading the old `parse-unrecognized` hollow
   for a fresh one (a regression, NOT a fix). The recruit-placement branch is the real
   executor; the play-time path must stay a benign, not-hollow no-op.
   **Caveat (drift test):** `MVP_KEYWORDS = HANDLED_KEYWORDS ∪ FROZEN_REVEAL_TRANSLATED`,
   and a drift test (`heroEffects.execute.test.ts`) asserts every member is handled
   directly OR reveal-translated. `wall-crawl` is neither, so it must enter `MVP_KEYWORDS`
   via a NEW reachability category (a `RECRUIT_TIME_EXECUTED_KEYWORDS` set spread in —
   NOT via `HANDLED_KEYWORDS`, which would demand a handler), and that drift test must be
   amended to admit it. See Scope §C/§F.

> **Honest-fix invariant.** The placement MUST be genuinely implemented — not a
> bare re-timing that silences the `onPlay` hollow while the card still does nothing.
> The mandatory execution scaffold (EC §Before Starting) proves the recruit
> placement actually moves the card to the deck top when chosen, before close.

---

## RS-1 (resolved from source at draft; scaffold re-verifies + proves the honest fix)

Most of the wiring is **resolved from source** (read during drafting); the scaffold
*re-verifies* these observably rather than discovering them, and proves the honest fix.

**Resolved from source (drafting reads — scaffold confirms, does not discover):**
- **Hook query is 2-arg.** `getHooksForCard(hooks, cardId)` has NO timing parameter
  (`rules/heroAbility.types.ts`). The recruit branch composes the read-only helpers —
  `filterHooksByTiming(getHooksForCard(G.heroAbilityHooks, cardId), 'onRecruit')` then a
  `keywords.includes('wall-crawl')` check (or an inline `hook.timing === 'onRecruit' &&
  hook.keywords.includes('wall-crawl')` scan). There is no 3-arg `getHooksForCard`; do
  not invent one. The query is read-only (returns a fresh array; never mutates a hook).
- **Hook keying.** Hooks key by the canonical-face zone-instance ext_id
  (`heroCardInstanceExtIds`, D-18705) — the same id space the recruited `cardId`
  (`G.hq[hqIndex]`) carries, so `getHooksForCard` resolves the wall-crawl hook for the
  recruited card. (Per the engine ext_id grammar, lookup tables key by zone-instance
  ext_id.)
- **Deck "top" = `deck[0]` (unshift).** `drawFromPlayerDeck` and `applyRevealDraw` both
  draw `deck[0]`, so the next-draw position is index 0 → `playerZones[pid].deck
  .unshift(cardId)`. (Assert via a draw, not a raw index — see §F.)
- **`RecruitHeroArgs` is local** to `moves/recruitHero.ts` (`interface RecruitHeroArgs
  { hqIndex: number }`), NOT a shared types module — so Scope §E does NOT apply (no
  separate file; one fewer file than the upper-bound count).
- **The play-time no-op + `MVP_KEYWORDS` interaction** per the onRecruit Execution Model
  §2/§5 (the magnitude-gate skip + the `applied` classification; the drift-test amendment).

**Mandatory scaffold proof (observed run — no reasoning substitutes):**
1. `filterHooksByTiming(getHooksForCard(G.heroAbilityHooks, recruitedCardId), 'onRecruit')`
   returns ≥1 hook whose `keywords` includes `'wall-crawl'` for a real recruited
   wall-crawl HQ card.
2. The parser normalizes `[keyword:Wall-Crawl]` → `wall-crawl` (case-insensitive) and
   `KEYWORD_TIMING_DEFAULTS` lands it on an `onRecruit` hook with NO `unresolvedMarkers`.
3. **Honest fix:** with `toTopOfDeck: true`, the recruited card is at `deck[0]`
   immediately after the move — proven by **drawing 1 card and getting the recruited
   card back** — NOT a bare re-timing that only silences the hollow.
4. **Discard branch byte-identical:** with `toTopOfDeck` falsy / omitted, or a
   non-wall-crawl hero, the post-move `discard` array AND the recruit `G.messages` line
   are byte-equal to today.
5. **Play-time path:** playing the wall-crawl hero mutates no onPlay state AND emits no
   hollow — neither `parse-unrecognized` nor `no-handler` — and `MVP_KEYWORDS` membership
   is what holds the second half.
6. **Ledger/sweep deltas:** `wall-crawl` flips `unsupported → executable` for all 29
   lines / 14 heroes; runtime-observed `wall-crawl` 23 → 0; record the `sim:coverage`
   baseline delta and confirm the sweep sentinel `finalStateHash` is UNCHANGED (the bot
   declines — see Determinism).

If the scaffold contradicts any resolved-from-source fact above, fold the correction
in-scope (`01.1` mid-execution amendment) before locking.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; **moves never throw** (only `Game.setup()` may); `G` stays
  JSON-serializable; the new arg is a boolean.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; no `.reduce()` in
  move/effect logic — use `for...of`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — named-export
  imports, descriptive names (`toTopOfDeck`, not `ttd`), full-sentence errors,
  functions ≤ ~30 lines, no premature abstraction. `// why:` on non-obvious decisions.

**Packet-specific:**
- **Recognize the EXISTING marker; re-mark nothing.** The 29 `[keyword:Wall-Crawl]`
  lines already exist in `data/cards/**`. **No `data/cards/**` change, no apply-script
  change, no new marker.** The parser change is the only reason the token starts
  resolving.
- **Additive only.** `wall-crawl` appends to `HeroKeyword` + `HERO_KEYWORDS` + a new
  `MVP_KEYWORDS` entry; `recruitHero` gains an optional arg; the parser gains a
  keyword→timing default. **Existing recruit behavior is byte-identical** when
  `toTopOfDeck` is falsy or the card has no wall-crawl hook (the discard placement,
  the economy deduction, the HQ refill, and the locked `G.messages` recruit-log line
  are all unchanged on that path).
- **No new move; no board-freeze guard.** Do NOT add a pending-choice queue, a
  resolve move, or any `hasPending*` block-all guard. The move-registration drift
  test (`game.test.ts`) MUST stay green unchanged.
- **First onRecruit path, kept minimal.** Add the onRecruit execution only as far as
  wall-crawl needs (a per-card hook check + the placement branch in `recruitHero`).
  Do NOT build a generic onRecruit effect-dispatch loop, add other onRecruit
  keywords, or touch `onFight` / `onKO` / `onReveal`.
- **Wall-crawl-specific check; composes with future onRecruit hooks.** The recruit
  branch must test specifically for a `wall-crawl` keyword on an `onRecruit` hook (e.g.
  `filterHooksByTiming(...).some(hook => hook.keywords.includes('wall-crawl'))`) —
  NEVER "take the first onRecruit hook and assume it is wall-crawl." If a card ever
  carries multiple onRecruit hooks/keywords, wall-crawl handling stays independent and
  must not block or short-circuit the others. (We add no other onRecruit keyword here;
  this is forward-protection so the next one composes.)
- **Determinism (strict).** Recruiting to deck-top changes deck order ⇒
  replay/`finalStateHash` sensitive. The bot/sim policy defaults `toTopOfDeck` **false**
  (decline → discard), so the deterministic sweep's zone state is unchanged and the
  sweep sentinel `finalStateHash` **MUST be unchanged**. A sentinel divergence is a FAIL
  to investigate — NOT a routine re-pin — UNLESS it traces to a deliberately added
  replay fixture that exercises `toTopOfDeck: true`, in which case re-pin per WP-236 and
  say so with the evidence. No other divergence is permitted. Only the **diagnostics**
  change on the default path (the wall-crawl hollows vanish). Regenerate every committed
  coverage artifact in the SAME commit.
- **Engine + its tests + regenerated coverage artifacts + governance only.** No
  `apps/**`, no `packages/registry/**`, no `apps/server/**`, no `data/cards/**`.

**Locked Contract Values:**
- Keyword: `'wall-crawl'` (appended to the `HeroKeyword` union + `HERO_KEYWORDS`
  array, and added to `MVP_KEYWORDS`), `// why: D-24049`.
- Default timing: `wall-crawl → 'onRecruit'` via `KEYWORD_TIMING_DEFAULTS` in
  `setup/heroAbility.setup.ts` (a `[timing:X]` marker still overrides; keywords
  absent from the map keep the `onPlay` default).
- Move arg: `recruitHero` args become `{ hqIndex: number; toTopOfDeck?: boolean }`
  (additive optional; omitted/`false` ⇒ today's discard placement). No new move.
- Hook query: `getHooksForCard(hooks, cardId)` is **2-arg** (no timing param); the
  recruit branch composes it with `filterHooksByTiming(..., 'onRecruit')` + a
  `keywords.includes('wall-crawl')` check (read-only). No 3-arg `getHooksForCard` exists.
- Placement: when `toTopOfDeck === true` AND the recruited card has an `onRecruit`
  `wall-crawl` hook, the card is placed at the **next-draw position `deck[0]`** via
  `playerZones[pid].deck.unshift(cardId)` (`deck[0]` confirmed as next-draw against
  `drawFromPlayerDeck`); else `playerZones[pid].discard.push(cardId)` (unchanged).
- Classification: `wall-crawl ∈ MVP_KEYWORDS` ⇒ ledger `executable`; handler column
  resolves to `moves/recruitHero.ts` (the recruit-placement executor), confirmed by
  the hero-ledger's `handlerForMechanic` path at execution.
- `MVP_KEYWORDS` mechanism: add `wall-crawl` via a NEW `RECRUIT_TIME_EXECUTED_KEYWORDS`
  set spread into the `MVP_KEYWORDS` literal — NOT via `HANDLED_KEYWORDS` (which would
  demand a non-existent `HERO_EFFECT_HANDLERS` entry and break the handler-key
  bidirectional drift test). The `every MVP_KEYWORD is handled-or-reveal-translated`
  drift test (`heroEffects.execute.test.ts`) MUST be amended to admit the
  recruit-time-executed category, else it fails for `wall-crawl`.

---

## Scope (In)

### A) `rules/heroKeywords.ts` — modified
Append `'wall-crawl'` to the `HeroKeyword` union + `HERO_KEYWORDS` array (a single
new entry, `// why: D-24049`). The drift test asserting union↔array parity is
updated in §F.

### B) `setup/heroAbility.setup.ts` — modified
Add a `KEYWORD_TIMING_DEFAULTS` map (`{ 'wall-crawl': 'onRecruit' }`) consulted in
the per-line timing assignment: when no explicit `[timing:X]` marker is present and
the line's keyword has a default-timing entry, use it; otherwise keep `onPlay`.
`[keyword:Wall-Crawl]` now resolves to a recognized `wall-crawl` keyword on an
`onRecruit` hook (no `unresolvedMarkers` entry). `// why: D-24049`.

### C) `hero/heroEffects.execute.ts` — modified
Add `'wall-crawl'` to `MVP_KEYWORDS` via a new `RECRUIT_TIME_EXECUTED_KEYWORDS` set
(spread into the `MVP_KEYWORDS` literal — NOT into `HANDLED_KEYWORDS`, which requires a
handler). Two effects: (1) the hero ledger classifies `wall-crawl` `executable`;
(2) `classifyHeroEffectReason` returns `applied` for it, so `detectHollowHeroHook`
classifies the **play-time-visited** wall-crawl hook **not hollow** instead of firing a
`no-handler` hollow (the regression that membership prevents — see Execution Model §5).
The `onPlay` dispatch DOES reach the auto-emitted `{ type: 'wall-crawl' }` effect but
no-ops on the missing magnitude — confirm it mutates nothing. `// why: D-24049`.

### D) `moves/recruitHero.ts` — modified
Add the optional `toTopOfDeck?: boolean` arg (extend the LOCAL `RecruitHeroArgs`
interface in this file — it is not a shared type). After the existing stage + pending
gates, before the placement: read the card's onRecruit wall-crawl hook via the
read-only helpers — `filterHooksByTiming(getHooksForCard(G.heroAbilityHooks, cardId),
'onRecruit')` then `.some(hook => hook.keywords.includes('wall-crawl'))` (there is NO
3-arg `getHooksForCard`). If such a hook is present AND `toTopOfDeck === true`, place
the card at the next-draw position via `playerZones[pid].deck.unshift(cardId)` (a
`// why: D-24049` comment); otherwise keep `playerZones[pid].discard.push(cardId)`
unchanged. The economy deduction, HQ refill, and the locked recruit-log line are
unchanged. Append a placement note to the existing recruit `G.messages` line ONLY when
the deck-top branch is taken (byte-locked format; the discard branch's line is
byte-identical to today).

### E) (Resolved — N/A) shared recruit-args type
**Confirmed not applicable.** `RecruitHeroArgs` is declared LOCALLY in
`moves/recruitHero.ts` (`interface RecruitHeroArgs { hqIndex: number }`), not in a
shared types module, so the `toTopOfDeck?: boolean` add lands in §D and there is NO
separate types file to modify. (Was a draft-time conditional; resolved from source.)

### F) Tests
- `rules/heroAbility.setup.test.ts` — **modified**: the HERO_KEYWORDS union↔array
  drift test (new count); a parse test that `[keyword:Wall-Crawl]` yields a recognized
  `wall-crawl` keyword on an `onRecruit` hook with NO `unresolvedMarkers` and an
  `effects: [{ type: 'wall-crawl' }]` descriptor (the auto-emitted no-magnitude effect).
- `moves/recruitHero.test.ts` — **modified (or new)**: recruiting a wall-crawl hero with
  `toTopOfDeck: true` puts it at the next-draw position — assert by **drawing 1 card and
  checking it IS the recruited card** (contract-level, not a raw index); with
  `toTopOfDeck` falsy / omitted it goes to discard byte-identical to today; a
  non-wall-crawl hero with `toTopOfDeck: true` is unaffected (goes to discard, deck order
  unchanged); 0-cost / insufficient-recruit and empty-slot guards unchanged.
- `hero/heroEffects.execute.test.ts` — **modified**: (1) **amend** the existing
  `every MVP_KEYWORD is handled directly or via reveal translation` drift test
  (≈ lines 66–75) to admit the recruit-time-executed category — otherwise it FAILS for
  `wall-crawl` (neither handled nor reveal-translated); (2) playing a wall-crawl hero
  produces no onPlay state mutation AND no hollow (neither `parse-unrecognized` nor
  `no-handler` — the regression guard); (3) `wall-crawl ∈ MVP_KEYWORDS`. The
  `HANDLED_KEYWORDS` count + handler-key bidirectional test stay UNCHANGED (no handler
  added).

### G) Regenerated coverage artifacts (committed; CI-gated)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — `wall-crawl` rows flip
  `unsupported → executable` (29 lines / 14 heroes). Regenerate via `pnpm ledger:heroes`.
- `docs/ai/coverage/runtime-observed-hollows.json` — the `wall-crawl` entry (23 obs)
  drops out; regenerate via `pnpm sim:runtime-observed`.
- The committed `sim:coverage` baseline (`scripts/coverage/hero-effect-coverage*.json`
  or the file `sim:coverage --check` compares — confirm path at execution) —
  regenerate / re-baseline per the WP-250 discipline.
- `data/metadata/card-mechanics.json` — the WP-269 feed; `wall-crawl` becomes a
  recognized mechanic. Regenerate via `pnpm mechanics:metadata`.
- `scripts/coverage/mechanic-provenance.json` — add the `wall-crawl → { wp: "WP-273",
  decision: "D-24049" }` entry (additive; fills the ledger wp/decision columns).

### H) Governance (at close)
`docs/ai/DECISIONS.md` (D-24049 Reserved → Active), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md` (WP-273 `[x]`), `docs/ai/execution-checklists/
EC_INDEX.md` (EC-304 → Done), `docs/05-ROADMAP-MINDMAP.md` (WP-273 ✅ + count table;
`roadmap-counts --check` green).

---

## Out of Scope

- **The dodge / undercover / unleash ecosystem.** Coupled on the Black Widow deck
  and requiring a new face-down victory-pile zone model — a separate, larger WP
  (or WP set). Named, not started here.
- **The arena-client UI for the wall-crawl choice.** The engine accepts the
  `toTopOfDeck` arg and the bot defaults to decline; the player-facing "put on top
  of your deck?" toggle in `apps/arena-client/**` is a follow-up client WP (the
  WP-248 → WP-249 engine/UX split pattern). No `apps/**` change here.
- **A generic onRecruit effect-dispatch loop or any other onRecruit keyword.** This
  WP builds only the minimal recruit-time path wall-crawl needs.
- **Any `data/cards/**` re-marking** — the markers already exist; only the parser
  changes. No apply-script / `inputs/*` change.
- **Registry / server / preplan / other-app change.**

---

## Files Expected to Change

### Implementation / tests
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (keyword→timing default + recognition).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (`MVP_KEYWORDS` + hollow classification).
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** (arg + onRecruit placement).
- ~~`packages/game-engine/src/moves/coreMoves.types.ts` / `types.ts`~~ — **N/A (resolved)**: `RecruitHeroArgs` is local to `recruitHero.ts`; no shared types file changes.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/moves/recruitHero.test.ts` — **modified / new** (placement branches).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (no onPlay hollow; MVP membership).

### Regenerated artifacts (committed)
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- the `sim:coverage` committed baseline file — **regenerated** (path confirmed at execution).
- `data/metadata/card-mechanics.json` — **regenerated** (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `wall-crawl` entry).

### Governance (at close)
- `docs/ai/DECISIONS.md` — D-24049 Reserved → Active.
- `docs/ai/STATUS.md` — updated.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-273 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-304 → Done.
- `docs/05-ROADMAP-MINDMAP.md` — WP-273 ✅ + count table.

**Total: ~12 implementation/artifact + 5 governance** (the conditional shared-types
file #E is resolved N/A — `RecruitHeroArgs` is local). Over the lint §5 ~8 guideline —
justified inline: a recognized keyword is irreducibly *keyword + parser-timing +
executor-classification + the recruit-move placement + their drift/behavior tests*, and
the change flips a CI-gated coverage surface so **every committed coverage artifact must
regenerate in the same commit** (the WP-253 / WP-272 precedent). No new move, no new
contract file, no board-freeze guard.

---

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior), §2 (card data — read-only),
§22 (determinism). **No conflict.** Makes a printed keyword execute as written;
invents no card text; re-marks no data. Determinism preserved (a pure
recruit-placement branch + a deterministic bot default of decline; the only
state-order change is the optional deck-top placement, replay-pinned per WP-236).
Non-Goals NG-1..7: none crossed.

## Funding Surface Gate

**N/A — justified.** Gameplay engine only; no funding affordance, copy, or channel.

## API Catalog (§21)

**N/A — justified.** `recruitHero` is a boardgame.io move (an additive optional arg),
not an `apps/server` HTTP endpoint or a `Library-only` catalog function. None added/
modified/removed.

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE. Any single FALSE = failed execution (STOP).**

1. `HeroKeyword` union + `HERO_KEYWORDS` array each contain `'wall-crawl'` once (same
   index); `'wall-crawl' ∈ MVP_KEYWORDS`; the union↔array drift test passes.
2. Parsing a `[keyword:Wall-Crawl]` line yields a recognized `wall-crawl` keyword on
   an **`onRecruit`** hook with **no `unresolvedMarkers`** entry. Playing such a card
   mutates **no onPlay state** and fires **no hollow** — neither `parse-unrecognized`
   nor `no-handler` (the play-time-visited hook classifies `applied` via `MVP_KEYWORDS`).
3. `recruitHero({ hqIndex, toTopOfDeck: true })` for a wall-crawl hero places the card
   at the **next-draw position (`deck[0]`)** of `playerZones[pid].deck` — verified by
   drawing 1 card and getting the recruited card back; `toTopOfDeck` falsy/omitted, or a
   non-wall-crawl hero, places it in `discard` **byte-identical to today** (economy
   deduction, HQ refill, and the discard-branch recruit-log line all unchanged, deck
   order untouched).
4. No new move is registered: `game.test.ts`'s move-set + move-count assertion is
   **unchanged and green**; no `hasPending*` board-freeze guard is added.
5. The hero mechanic ledger shows `wall-crawl` `executable` for all 29 lines / 14
   heroes with the `handler` column at the recruit-placement executor; the
   runtime-observed sweep no longer lists a `wall-crawl` entry (23 → 0).
6. `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` exit 0 with
   the net-new cases; no pre-existing test regresses; the replay sentinel
   `finalStateHash` is unchanged OR re-pinned per WP-236 (scaffold-confirmed).
7. Every committed coverage artifact is regenerated and its freshness gate passes:
   `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`,
   `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all exit 0;
   the `mechanic-provenance.json` diff is additive (`wall-crawl` only).
8. `git diff --name-only` lists exactly the files in `## Files Expected to Change`
   (§E resolved N/A — not present); no `data/cards/**`, `apps/**`,
   `packages/registry/**`, or `apps/server/**` change.
9. The existing `every MVP_KEYWORD is handled directly or via reveal translation`
   drift test is amended to admit the recruit-time-executed category and is green; the
   `HANDLED_KEYWORDS` count + handler-key bidirectional test are **unchanged** (no
   handler added). `wall-crawl`'s not-hollow status holds at play time independent of
   the `toTopOfDeck` choice (there is no recruit-time hollow path).

---

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine test          # BASELINE — record pass count
pnpm -r build                                            # exits 0
pnpm --filter @legendary-arena/game-engine test          # ≥ BASELINE + net-new; no regression
grep -c "wall-crawl" packages/game-engine/src/rules/heroKeywords.ts   # 2 (union + array)
grep -n "unshift" packages/game-engine/src/moves/recruitHero.ts       # deck[0] placement present
grep -n "RECRUIT_TIME_EXECUTED\|wall-crawl" packages/game-engine/src/hero/heroEffects.execute.ts   # MVP_KEYWORDS add via the recruit-time category
pnpm ledger:heroes && pnpm sim:runtime-observed && pnpm mechanics:metadata   # regenerate
pnpm ledger:heroes:check && pnpm sim:coverage --check && pnpm sim:runtime-observed:check && pnpm mechanics:metadata:check   # all OK
grep -E ",wall-crawl,executable," docs/ai/coverage/hero-mechanic-ledger.csv | head   # executable rows present
git diff --name-only -- data/cards/ apps/ packages/registry/ apps/server/   # empty
node scripts/roadmap-counts.mjs --check                  # passes (WP-273 ✅)
```

---

## Definition of Done

- [ ] All Acceptance Criteria (1–9) pass.
- [ ] `build` + engine `test` exit 0; the four coverage freshness gates pass; drift grep passes.
- [ ] `docs/ai/DECISIONS.md` D-24049 Reserved → Active (byte-identical to the EC-304 verbatim block).
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` WP-273 `[x]`; `EC_INDEX.md` EC-304 → Done; `05-ROADMAP-MINDMAP.md` WP-273 ✅; `roadmap-counts --check` green.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `User-Visible Surface = dashboard.legendary-arena.com/coverage` — the `wall-crawl`
      rows flip `unsupported → executable` on the deployed `/coverage` page AND the
      `/coverage` runtime-observed (Observed-in-play) section shows **zero** `wall-crawl`
      entries (23 → 0), both D-24026 live-verified post-deploy. *(The in-game
      player-facing "put on top of your deck?" toggle is the deferred arena-client
      follow-up; the engine + the coverage surface are this WP's observable deliverable.)*

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order pre-flight → copilot → lint, against `origin/main` @ `04c36ba2`.

- **Pre-flight (01.4): READY TO EXECUTE (2026-06-21).** Class: **Behavior / State
  Mutation** (a new keyword + the first `onRecruit` execution path; mutates deck
  placement, no new move). Contract fidelity verified against source: `recruitHero`
  places to discard at the line this WP branches (`moves/recruitHero.ts:86`);
  `onRecruit` is a live `HeroAbilityTiming` member with **no executor today**
  (`rules/heroKeywords.ts:89/102`); `MVP_KEYWORDS` + `detectHollowHeroHook` are the
  ledger/hollow surfaces (`hero/heroEffects.execute.ts`); the marker `[keyword:Wall-Crawl]`
  exists across 29 lines / 14 heroes in `data/cards/**` and the glossary text is
  unambiguous. Deps (WP-021/022/016/135/253/257/259/265) ✅ on `main`. Scope is a
  closed allowlist (game-engine + its tests + regenerated coverage artifacts +
  governance; `apps`/`registry`/`server`/`data/cards` out). **One genuine RS — RS-1
  (clarifying, non-blocking):** the exact onRecruit-hook keying for an HQ card id, the
  `KEYWORD_TIMING_DEFAULTS` insertion point + token case-normalization, the player-deck
  "top" end, and the hollow-classifier change are scaffold-confirmed at execution
  (the EC mandates the scaffold + the honest-fix proof). RS-1 is "confirm the exact
  surface", not a dependency blocker. Verdict READY.
- **Copilot check (01.7): PASS (2026-06-21) — disposition CONFIRM.** Boundary
  (engine + simulation + card-data-tooling artifacts only; no `apps`/`registry`/
  `server`/`data/cards`; no registry import in the move/executor). Determinism
  (#2/#23 — pure recruit-placement branch; bot defaults to decline so the sweep's
  zone state is unchanged; deck-top placement is replay-pinned; sentinel re-pin only
  on divergence). Honest-fix / silent-vs-loud (#22 — the placement is genuinely
  implemented, proven by the scaffold; not a bare re-timing that silences the hollow).
  Scope creep (#12/#30 — no pending-choice subsystem, no new move, no generic
  onRecruit loop, no other keyword; the dodge/undercover/unleash ecosystem + the
  client UI are explicitly deferred). Source-of-truth (#27 — `wall-crawl` recognized
  from the closed union, not re-derived). The review-surfaced risk (the onRecruit
  wiring) is captured as RS-1 and routed to the scaffold. No RISK/BLOCK.
- **Review hardening (2026-06-21) — source-grounded corrections folded in.** A read of
  the actual engine surfaces narrowed RS-1 from "open wiring" to "scaffold re-verifies
  resolved facts" and corrected three mechanism statements the on-paper draft had wrong:
  (a) `getHooksForCard` is **2-arg** (no timing param) — the recruit branch composes
  `filterHooksByTiming` + a `keywords` check (no 3-arg call exists); (b)
  `executeHeroEffects` does NOT filter by timing, so the onRecruit hook IS visited at
  play time — the no-onPlay-effect result comes from the magnitude-gate skip, not from
  the hook being unseen; (c) `MVP_KEYWORDS` membership is load-bearing — it prevents a
  NEW `no-handler` onPlay hollow (a regression), and adding it forces an amendment to the
  `every MVP_KEYWORD is handled-or-translated` drift test. Scope §E resolved N/A
  (`RecruitHeroArgs` is local). These are accuracy / enforceability fixes to the spec,
  not design changes; the locked design (keyword + onRecruit timing + optional
  recruit-placement, no new move) is unchanged.

---

## Lint Gate Self-Review (`00.3`)

**Verdict: PASS** — all 21 sections resolved (PASS or justified N/A); Final Gate clear.

- **§1 Structure:** PASS — Goal / Assumes / Context / Scope (In) / Out of Scope /
  Files / Non-Negotiable Constraints / Acceptance Criteria / Verification Steps /
  Definition of Done all present + non-empty; Out of Scope lists ≥4 exclusions.
- **§2 Constraints:** PASS — Engine-wide block requires full file contents, forbids
  diffs/snippets, states ESM/Node v22+, cites `00.6-code-style.md`; packet-specific
  + locked contract values present; no body contradiction.
- **§3 Assumes:** PASS — each dependency + the exact source surfaces (the discard
  placement line, the dormant `onRecruit` timing, `MVP_KEYWORDS`/hollow detection,
  the existing markers) enumerated; the genuine open item is flagged as RS-1, not
  assumed.
- **§4 Context:** PASS — specific files/sections + DECISIONS ids (D-24024/34/44/45);
  the Wall-Crawl rules text sourced from the glossary; canonical field names honored.
- **§5 Files:** PASS — every changed file listed + marked (modified/new/regenerated/
  conditional), in three groups; explicit non-change list; over-8 justified inline
  (irreducible keyword end-to-end + CI-gated artifact regen); single layer (game-engine
  + its tooling artifacts).
- **§6 Naming:** PASS — `wall-crawl` / `toTopOfDeck` / `onRecruit` / `KEYWORD_TIMING_DEFAULTS`
  / `MVP_KEYWORDS` / `getHooksForCard` match the engine vocabulary; no abbreviations.
- **§7 Dependencies:** PASS — no new npm deps; reuses the hook pipeline + zone helpers.
- **§8 Architecture:** PASS — Game Engine layer only (+ its CI-gated coverage
  artifacts); `G` runtime-only; moves never throw; no registry import; no `.reduce()`;
  no persistence/snapshot change.
- **§9 Windows / §10 Env / §11 Auth:** N/A — Node built-ins; no shell-specific paths,
  env vars, or auth surface.
- **§12 Tests:** PASS — `node:test`, `.test.ts`, `makeMockCtx`; no boardgame.io/network/
  DB; determinism preserved (pure placement branch + deterministic bot default).
- **§13 Verification:** PASS — exact `pnpm` / `grep` / `node` commands with expected output.
- **§14 Acceptance:** PASS — 9 binary, observable, code-path-specific items.
- **§15 Definition of Done:** PASS — STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap +
  scope-boundary check. **§15.1:** `User-Visible Surface = dashboard.legendary-arena.com/
  coverage` declared with the D-24026 live-verify item (the deferred in-game toggle noted).
- **§16 Code Style:** PASS — `// why:` on the keyword, the timing default, the
  `MVP_KEYWORDS` add, and the deck-top placement branch; named imports; no `.reduce()`;
  small functions; full-sentence messages.
- **§17 Vision:** TRIGGERED (card behavior / determinism — §1/§2/§22). `## Vision
  Alignment` present with clause numbers, a no-conflict assertion, and a
  determinism-preservation line.
- **§18 Prose-vs-Grep:** PASS — the `grep` verification targets source/artifacts
  (`heroKeywords.ts` count, the ledger CSV), not this WP's prose; no forbidden-token
  enumeration adjacent to a literal grep.
- **§19 Bridge-vs-HEAD:** N/A — not a repo-state-summarizing artifact.
- **§20 Funding Surface:** N/A with justification (gameplay engine; no funding surface).
- **§21 API Catalog:** N/A with justification (an engine move arg, not an `apps/server`
  endpoint/`Library-only` function).

Verdict: **PASS** — all 21 sections resolved; Final Gate clear. Execution remains
gated on the RS-1 scaffold confirming the onRecruit wiring + the honest-fix proof
(the placement genuinely runs), and on the four coverage freshness gates after regen.
