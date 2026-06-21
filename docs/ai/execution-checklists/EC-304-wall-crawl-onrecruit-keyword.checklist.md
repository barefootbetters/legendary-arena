# EC-304 — Wall-Crawl: onRecruit Keyword + Optional Recruit-to-Deck Placement

**Source:** docs/ai/work-packets/WP-273-wall-crawl-onrecruit-keyword.md
**Layer:** Game Engine — recognize the existing `[keyword:Wall-Crawl]` marker, give
it an `onRecruit` default timing, and add an optional recruit-to-deck-top placement
to the `recruitHero` move. Plus the regenerated CI-gated coverage artifacts.
**No `data/cards/**` / `apps/**` / `packages/registry/**` / `apps/server/**` change.**
The markers already exist; only the parser starts resolving them.
**Decision:** D-24049 (reserved at draft; landed at execution). Wall-crawl = recognized
keyword with onRecruit timing + optional recruit-placement; no new move, no board-freeze.

Authoritative execution contract for WP-273. Compliance is binary.

---

## Before Starting
- [ ] On `main`, clean, ff-synced to `04c36ba2` (or later). Baseline-green:
  `pnpm -r build`; `pnpm --filter @legendary-arena/game-engine test`;
  `pnpm ledger:heroes:check`; `pnpm sim:coverage --check`;
  `pnpm sim:runtime-observed:check`; `pnpm mechanics:metadata:check` all exit 0.
- [ ] Read `moves/recruitHero.ts` (the discard placement at ~:86 this WP branches),
  `setup/heroAbility.setup.ts` (the per-line timing-default assignment), and
  `hero/heroEffects.execute.ts` (`MVP_KEYWORDS`, `getHooksForCard`, `detectHollowHeroHook`).
- [ ] **MANDATORY SCAFFOLD (the RS-1 de-risk + the honest-fix proof):** before locking,
  prototype and **observe** (these re-verify the WP RS-1 source reads — the API facts are
  already resolved, do NOT re-derive them):
  (1) the onRecruit wall-crawl hook is reachable via the **2-arg**
  `getHooksForCard(G.heroAbilityHooks, recruitedCardId)` + `filterHooksByTiming(...,
  'onRecruit')` + a `keywords.includes('wall-crawl')` check — there is NO 3-arg
  `getHooksForCard`; the recruited `cardId` (`G.hq[hqIndex]`) keys the hook (D-18705
  zone-instance ext_id);
  (2) the parser normalizes `[keyword:Wall-Crawl]` → `wall-crawl` (case-insensitive),
  `KEYWORD_TIMING_DEFAULTS` lands it on an `onRecruit` hook with NO `unresolvedMarkers`,
  and an `effects: [{ type: 'wall-crawl' }]` (no-magnitude) descriptor is auto-emitted;
  (3) deck "top" = `deck[0]` (next-draw, per `drawFromPlayerDeck`) → `unshift`;
  (4) **honest fix:** with `toTopOfDeck: true` the card is at `deck[0]` after the move
  (draw 1 → it IS the recruited card), NOT a bare re-timing that only silences the hollow;
  (5) **play-time path:** playing the wall-crawl hero mutates no onPlay state (the
  `{ type: 'wall-crawl' }` effect no-ops on the missing magnitude) AND fires no hollow —
  and confirm `wall-crawl ∈ MVP_KEYWORDS` is what prevents a NEW `no-handler` onPlay
  hollow (without it, `classifyHeroEffectReason` returns `no-handler` → regression);
  (6) adding `wall-crawl` to `MVP_KEYWORDS` (via a `RECRUIT_TIME_EXECUTED_KEYWORDS`
  spread, NOT `HANDLED_KEYWORDS`) trips the `every MVP_KEYWORD is handled-or-translated`
  drift test → confirm the amendment admitting the recruit-time category;
  (7) the measured ledger flip (`wall-crawl` unsupported → executable, 29 lines / 14
  heroes), runtime-observed `wall-crawl` 23 → 0, the `sim:coverage` baseline delta, and
  that the sweep sentinel `finalStateHash` is UNCHANGED (bot declines). If anything
  differs from the above, fold the correction in-scope (`01.1`) before writing final code.

---

## Locked Values
- **WP:** WP-273. **EC:** EC-304. **Decision:** D-24049, reserved.
- **Keyword:** `'wall-crawl'` — append to the `HeroKeyword` union + `HERO_KEYWORDS`
  array + add to `MVP_KEYWORDS`. (No other keyword; no new timing — `onRecruit`
  already exists.)
- **Default timing:** `wall-crawl → 'onRecruit'` via a new `KEYWORD_TIMING_DEFAULTS`
  map in `setup/heroAbility.setup.ts`; an explicit `[timing:X]` marker still overrides;
  keywords absent from the map keep the `onPlay` default.
- **Move arg (locked):** `recruitHero` args = `{ hqIndex: number; toTopOfDeck?: boolean }`
  — additive optional on the LOCAL `RecruitHeroArgs` interface in `recruitHero.ts` (not a
  shared type); omitted/`false` ⇒ today's discard placement. **No new move.**
- **Hook query (locked):** `getHooksForCard(hooks, cardId)` is **2-arg** (no timing
  param); reach the onRecruit wall-crawl hook via `filterHooksByTiming(getHooksForCard(
  G.heroAbilityHooks, cardId), 'onRecruit')` + `keywords.includes('wall-crawl')`
  (read-only). Do NOT invent a 3-arg `getHooksForCard`.
- **Placement (locked):** `toTopOfDeck === true` AND the recruited card has an
  `onRecruit` `wall-crawl` hook ⇒ `playerZones[pid].deck.unshift(cardId)` (the next-draw
  position `deck[0]`, confirmed against `drawFromPlayerDeck`); otherwise
  `playerZones[pid].discard.push(cardId)` (byte-identical to today).
- **Classification (locked):** `wall-crawl ∈ MVP_KEYWORDS` via a NEW
  `RECRUIT_TIME_EXECUTED_KEYWORDS` set (spread into `MVP_KEYWORDS`, NOT into
  `HANDLED_KEYWORDS`) ⇒ ledger `executable`; handler column = the recruit-placement
  executor (`moves/recruitHero.ts`). Membership ALSO makes `classifyHeroEffectReason`
  return `applied` for the play-time-visited hook → **not hollow** (prevents a
  `no-handler` regression). The `every MVP_KEYWORD is handled-or-translated` drift test
  MUST be amended to admit the recruit-time category.
- **Commit message (execution):** `EC-304: wall-crawl onRecruit keyword + recruit-to-deck placement (D-24049)`.

---

## Guardrails
- **Recognize the existing marker; re-mark nothing (HIGHEST RISK).** The 29
  `[keyword:Wall-Crawl]` lines already exist. **`data/cards/**` MUST be byte-unchanged;
  no apply-script / `inputs/*` change.** Only the parser change makes the token resolve.
- **Additive only; existing recruit path byte-identical.** When `toTopOfDeck` is falsy
  or the card has no wall-crawl hook, the discard placement, economy deduction, HQ
  refill, and the locked recruit `G.messages` line are byte-for-byte unchanged.
- **No new move; no board-freeze guard.** Do NOT add a pending-choice queue, a resolve
  move, or any `hasPending*` block-all guard. `game.test.ts` move-set/count MUST stay
  green unchanged. (Wall-crawl is NOT the WP-242/248 interactive-choice pattern.)
- **First onRecruit path, minimal.** Add onRecruit execution only as far as wall-crawl
  needs (the per-card hook check + the placement branch). NO generic onRecruit dispatch
  loop, NO other onRecruit keyword, NO `onFight`/`onKO`/`onReveal` change.
- **Honest fix.** The placement must genuinely run (scaffold-proven) — never a re-timing
  that silences the `onPlay` hollow while the card still does nothing.
- **Determinism (strict).** Bot/sim defaults `toTopOfDeck` **false** (decline → discard),
  so the deterministic sweep's zone state is unchanged and the sweep sentinel
  `finalStateHash` **MUST be unchanged**. A divergence is a FAIL to investigate — NOT a
  routine re-pin — unless it traces to a deliberate `toTopOfDeck: true` replay fixture
  (then re-pin per WP-236 and say so). Only diagnostics change on the default path.
  Regenerate every committed coverage artifact in the SAME commit.
- **`MVP_KEYWORDS` membership is REQUIRED, not cosmetic.** `executeHeroEffects` visits the
  onRecruit wall-crawl hook at play time (it does NOT filter by timing). Membership makes
  that visit classify `applied`/not-hollow; WITHOUT it the recognized keyword classifies
  `no-handler` and fires a NEW onPlay hollow — trading one hollow for another (a
  regression). Add via `RECRUIT_TIME_EXECUTED_KEYWORDS` (NOT `HANDLED_KEYWORDS`, which
  would demand a handler and break the handler-key bidirectional drift test).
- **Amend the MVP coverage drift test.** Adding `wall-crawl` to `MVP_KEYWORDS` fails the
  `every MVP_KEYWORD is handled directly or via reveal translation` test
  (`heroEffects.execute.test.ts`) unless it is amended to admit the recruit-time-executed
  category. This edit is in scope and MUST land in the same commit.
- **Wall-crawl-specific hook check.** Test for a `wall-crawl` keyword on an `onRecruit`
  hook; never "take the first onRecruit hook." Other future onRecruit hooks must compose
  unaffected (forward-protection; no other onRecruit keyword is added here).
- **Provenance additive.** Add `wall-crawl → { wp:"WP-273", decision:"D-24049" }` to
  `scripts/coverage/mechanic-provenance.json` (new key only; existing keys byte-unchanged).

---

## Required `// why:` Comments
- At the `wall-crawl` keyword (union + array): the printed Wall-Crawl ability;
  executable via the recruit-placement executor, not an `onPlay` handler (D-24049).
- At `RECRUIT_TIME_EXECUTED_KEYWORDS` / the `MVP_KEYWORDS` add: `wall-crawl` executes at
  recruit, so it has no `HERO_EFFECT_HANDLERS` entry; membership marks it ledger-
  `executable` AND keeps the play-time-visited hook `applied`/not-hollow (prevents a
  `no-handler` regression) (D-24049).
- At `KEYWORD_TIMING_DEFAULTS`: wall-crawl fires at recruit, not play; `[timing:X]` still
  overrides; keywords absent from the map keep `onPlay` (D-24049).
- At the `recruitHero` deck-top branch (`unshift`): the printed "may put it on top of
  your deck" — optional, the recruiting player's own deck/action, so no
  pending-choice/board-freeze; `deck[0]` is the next-draw position; the discard branch is
  unchanged (D-24049).
- (No `classifyHeroEffectReason` edit is needed — the `MVP_KEYWORDS` add alone yields the
  `applied` classification; the only test touch is the drift-test amendment.)

---

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (keyword→timing default + recognition).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (`MVP_KEYWORDS` + hollow classification).
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** (arg + onRecruit placement).
- ~~`packages/game-engine/src/moves/coreMoves.types.ts` / `types.ts`~~ — **N/A (resolved)**: `RecruitHeroArgs` is local to `recruitHero.ts`; no shared types file.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/moves/recruitHero.test.ts` — **modified / new** (placement branches).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (amend the MVP-coverage drift test for the recruit-time category; play-time = no onPlay mutation + no hollow; `wall-crawl ∈ MVP_KEYWORDS`; `HANDLED_KEYWORDS` count test unchanged).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- the committed `sim:coverage` baseline file — **regenerated** (path confirmed at execution).
- `data/metadata/card-mechanics.json` — **regenerated** (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `wall-crawl`).
- (NO `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`, new move, or board-freeze guard.)
- Governance: `STATUS.md`, `DECISIONS.md` (D-24049), `WORK_INDEX.md` (WP-273 ✅), `EC_INDEX.md` (EC-304 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `data/cards/**`, `apps/**`, `packages/registry/**`,
`apps/server/**`, `game.test.ts`'s move set/count MUST be byte-unchanged.

---

## After Completing
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` exit 0; no regression.
- [ ] Drift grep: `grep -c "wall-crawl" rules/heroKeywords.ts` = 2; `game.test.ts` move-count unchanged + green.
- [ ] MVP-coverage drift test amended (admits the recruit-time category) + green; `HANDLED_KEYWORDS` handler-count test UNCHANGED (no handler added).
- [ ] Play-time guard test green: playing a wall-crawl hero mutates no onPlay state and fires no hollow (neither `parse-unrecognized` nor `no-handler`).
- [ ] Deck-top proven by draw: recruit with `toTopOfDeck: true` then draw 1 ⇒ the recruited card.
- [ ] Ledger flip verified: `wall-crawl` `executable` (29 lines / 14 heroes) with the recruit-placement handler; runtime-observed `wall-crawl` 23 → 0.
- [ ] Four freshness gates pass: `ledger:heroes:check`, `sim:coverage --check`, `sim:runtime-observed:check`, `mechanics:metadata:check`.
- [ ] `git diff --name-only` → only the allowlist files; `git diff` empty for `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`. Provenance diff additive.
- [ ] Sentinel `finalStateHash` unchanged OR re-pinned per WP-236 (state which, with the scaffold evidence).
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-273 ✅).
- [ ] STATUS notes the D-24026 live-verify (the `/coverage` `wall-crawl` flip) as pending post-deploy; the in-game toggle is the deferred client follow-up.

---

## Close Notes Required in PR / Commit Body
- The measured ledger flip (wall-crawl unsupported → executable count) + the runtime-observed 23 → 0.
- The scaffold result: the onRecruit-hook keying for the recruited card, the deck "top" end (`deck[0]`/`unshift`), and proof the placement genuinely moves the card (honest fix).
- The play-time path: confirmation that the onRecruit hook is visited at play time and is a not-hollow no-op (magnitude-gated skip + `MVP_KEYWORDS` `applied`), and that the MVP-coverage drift test was amended for the recruit-time category.
- Confirmation `data/cards/**` + `apps/**` + `packages/registry/**` + `apps/server/**` + `game.test.ts` move-set are byte-unchanged, the provenance diff is additive, and whether the sentinel was re-pinned.

---

## Common Failure Smells
- A `data/cards/**` line in the diff → re-marking is out of scope; the markers exist; revert.
- A new move / a `hasPending*` guard / a `game.test.ts` move-count bump → the interactive-choice subsystem leaked in; wall-crawl is a recruit-arg, not a pending choice; revert.
- The `onPlay` hollow vanished but the recruit placement never moves the card → a dishonest re-timing; implement the placement and prove it in the scaffold.
- `wall-crawl` shows `deferred` not `executable` in the ledger → it was added to `HERO_KEYWORDS` but not `MVP_KEYWORDS`.
- A 3-arg `getHooksForCard(..., 'onRecruit')` in the diff → that signature does not exist; compose `filterHooksByTiming` + a `keywords.includes('wall-crawl')` check.
- `wall-crawl` added to `HANDLED_KEYWORDS` or given a `HERO_EFFECT_HANDLERS` entry → it executes at recruit, not play; enter `MVP_KEYWORDS` via the recruit-time category with NO handler, and keep the handler-key bidirectional drift test unchanged.
- The MVP-coverage drift test left unamended → it FAILS for `wall-crawl` (neither handled nor reveal-translated); admit the recruit-time category.
- Playing a wall-crawl hero starts firing a `no-handler` hollow → `wall-crawl` reached `HERO_KEYWORDS` but NOT `MVP_KEYWORDS`; membership is what keeps the play-time visit `applied`/not-hollow.
- A `sim:coverage`/ledger/runtime-observed freshness gate red → a coverage artifact was not regenerated in the same commit.
- The provenance diff touches a hero key other than the new `wall-crawl` → it must be additive; revert the churn.
