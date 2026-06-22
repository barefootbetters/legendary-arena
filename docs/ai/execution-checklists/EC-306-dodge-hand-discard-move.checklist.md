# EC-306 — Dodge: Hand-Discard-to-Draw Move + Recognized Keyword

**Source:** docs/ai/work-packets/WP-275-dodge-hand-discard-move.md
**Layer:** Game Engine — recognize the existing `[keyword:Dodge]` marker and add a new
`dodgeCard` move (discard a Dodge card from hand → draw one). Plus the regenerated
CI-gated coverage artifacts.
**No `data/cards/**` / `apps/**` / `packages/registry/**` / `apps/server/**` /
`ai.legalMoves.ts` change.** The markers already exist; only the parser + the new move.
**Decision:** D-24051 (reserved at draft; landed at execution). Dodge = recognized
keyword + a new non-core hand move; no new zone model, no board-freeze, the sim never
dodges (determinism).

Authoritative execution contract for WP-275. Compliance is binary.

---

## Before Starting
- [ ] On `main`, clean, ff-synced to `7a6f48b2` (or later). Baseline-green:
  `pnpm -r build`; `pnpm --filter @legendary-arena/game-engine test` (record the pass
  count); `pnpm ledger:heroes:check`; `pnpm sim:coverage --check`;
  `pnpm sim:runtime-observed:check`; `pnpm mechanics:metadata:check` all exit 0.
- [ ] Read `moves/recruitHero.ts` (the non-core internally-gated move precedent),
  `moves/coreMoves.impl.ts::playCard` (the `args.cardId` hand-targeting precedent),
  `moves/drawCards.logic.ts::drawCardsIntoHand` (the draw helper), `game.ts` `moves: {}`,
  `game.test.ts` (the exactly-11-moves assertion), and `hero/heroEffects.execute.ts`
  (`MVP_KEYWORDS`, `RECRUIT_TIME_EXECUTED_KEYWORDS`, `detectHollowHeroHook`).
- [ ] **MANDATORY SCAFFOLD (the honest-fix proof):** before locking, prototype and
  **observe** (these re-verify the WP RS-1 source reads — do NOT re-derive):
  (1) the parser normalizes `[keyword:Dodge]` → `dodge` (case-insensitive) on an `onPlay`
  hook with NO `unresolvedMarkers` and an `effects: [{ type: 'dodge' }]` descriptor;
  (2) **honest fix:** `dodgeCard({ cardId })` for a dodge card in hand REMOVES it from
  hand, APPENDS it to discard, and DRAWS one replacement (the `deck[0]` card lands in
  hand) — NOT a bare recognition that only silences the hollow;
  (3) ineligible calls (non-dodge card, card not in hand, `currentStage !== 'main'`, a
  pending KO-hero / optional-KO-reward choice) each leave `G` unmutated (no throw);
  (4) "ignore all other text": dodging a card that also declares onPlay text does NOT
  fire that text (it is discarded, never played);
  (5) **play-time path:** playing a dodge hero mutates no onPlay state (the `{ type:
  'dodge' }` effect no-ops on the missing magnitude) AND fires no hollow — and confirm
  `dodge ∈ MVP_KEYWORDS` is what prevents a NEW `no-handler` onPlay hollow (without it,
  `classifyHeroEffectReason` returns `no-handler` → regression);
  (6) `LegendaryGame.moves` has EXACTLY 12 keys incl. `dodgeCard`; adding `dodge` to
  `MVP_KEYWORDS` (via a `HAND_ACTION_EXECUTED_KEYWORDS` spread, NOT `HANDLED_KEYWORDS`)
  trips the `every MVP_KEYWORD …` drift test → confirm the extension admitting the
  hand-action category;
  (7) the measured ledger flip (`dodge` unsupported → executable, handler
  `moves/dodgeCard.ts`), runtime-observed `dodge` 37 → 0, the `sim:coverage` baseline
  delta, and that the sweep sentinel `finalStateHash` is UNCHANGED (the sim never
  generates a `dodgeCard` intent — `ai.legalMoves.ts` is untouched). If anything differs,
  fold the correction in-scope (`01.1`) before writing final code.

---

## Locked Values
- **WP:** WP-275. **EC:** EC-306. **Decision:** D-24051, reserved.
- **Keyword:** `'dodge'` — append to the `HeroKeyword` union + `HERO_KEYWORDS` array +
  add to `MVP_KEYWORDS`. (No other keyword; no new timing — `dodge` keeps the default
  `onPlay`, NOT in `KEYWORD_TIMING_DEFAULTS`.)
- **New move (locked):** `dodgeCard({ cardId }: DodgeCardArgs)` on a LOCAL `DodgeCardArgs
  { cardId: string }` interface in `moves/dodgeCard.ts` — **non-core**, internally gated
  to `currentStage === 'main'` (the recruitHero pattern); NOT in `CoreMoveName` /
  `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`. Registered in `game.ts` as
  `dodgeCard: { move: dodgeCard, client: false }`.
- **Move order (locked):** validate `cardId` is a non-empty string → stage gate (`main`)
  + the two existing block-all guards (`hasPendingKoHeroChoice` /
  `hasPendingOptionalKoReward`, return while pending) → eligibility → mutate. Moves never
  throw.
- **Eligibility (locked):** the card is in `playerZones[pid].hand` AND
  `getHooksForCard(G.heroAbilityHooks, cardId).some(h => h.keywords.includes('dodge'))`
  (read-only, timing-agnostic). Else return silently.
- **Effect (locked):** `moveCardFromZone(hand, discard, cardId)` (guard `found`), then
  `drawCardsIntoHand(playerZones, 1, ctx as ShuffleProvider)`; append a byte-locked
  `G.messages` dodge line. "Ignore all other text" is automatic — the card is discarded,
  never played, so its other effects never fire.
- **Move count (locked):** `game.test.ts` asserts **exactly 12** moves (was 11);
  `dodgeCard` is added to the expected move-name array (alphabetical: after
  `advanceStage`, before `drawCards`), the count, AND the `it('defines moves: …')`
  description string.
- **Classification (locked):** `dodge ∈ MVP_KEYWORDS` via a NEW
  `HAND_ACTION_EXECUTED_KEYWORDS` set (spread into `MVP_KEYWORDS` alongside
  `RECRUIT_TIME_EXECUTED_KEYWORDS`, NOT into `HANDLED_KEYWORDS`) ⇒ ledger `executable`;
  handler column = `moves/dodgeCard.ts`, via the ledger's move-executor handler-module
  mapping (extend the WP-273 `RECRUIT_TIME_HANDLER_MODULES` — sibling key or a renamed
  general map; executor's choice, but the handler column MUST resolve to
  `moves/dodgeCard.ts`). The `every MVP_KEYWORD …` drift test MUST be extended to admit
  the hand-action category.
- **Commit message (execution):** `EC-306: dodge hand-discard-to-draw move + recognized keyword (D-24051)`.

---

## Guardrails
- **Recognize the existing marker; re-mark nothing (HIGHEST RISK).** The 25
  `[keyword:Dodge]` lines already exist. **`data/cards/**` MUST be byte-unchanged; no
  apply-script / `inputs/*` change.**
- **One new move, registered + drift-tested in the SAME commit.** `dodgeCard` lands in
  `game.ts` `moves: {}` AND in `game.test.ts`'s move-set list + count (11 → 12) + the
  description string. Per `feedback_move_registration_drift_test`, `game.test.ts` is in
  the allowlist UP FRONT — not a mid-execution amendment.
- **The sim does NOT learn to dodge.** Do NOT edit `ai.legalMoves.ts` or the competent
  policy. The deterministic sweep MUST never generate a `dodgeCard` intent, so the sweep
  sentinel `finalStateHash` MUST be unchanged. A divergence is a FAIL to investigate —
  NOT a routine re-pin — unless it traces to a deliberate `dodgeCard` replay fixture
  (then re-pin per WP-236 and say so). Only diagnostics change on the default path.
  Regenerate every committed coverage artifact in the SAME commit.
- **No board-freeze guard ADDED; existing guards RESPECTED.** Do NOT add a pending-choice
  queue or a new `hasPending*` guard; the move *consults* the two existing block-all
  guards (returns while one is pending). Wall-crawl / dodge are NOT the WP-242/248
  interactive-choice pattern.
- **Honest fix.** The `dodgeCard` move must genuinely run (scaffold-proven: the card
  leaves hand, lands in discard, and one replacement is drawn) — never a bare keyword
  recognition that silences the `onPlay` hollow while no card can be dodged.
- **`MVP_KEYWORDS` membership is REQUIRED, not cosmetic.** `executeHeroEffects` visits
  the dodge hook at play time (it does NOT filter by timing). Membership makes that visit
  classify `applied`/not-hollow; WITHOUT it the recognized keyword classifies
  `no-handler` and fires a NEW onPlay hollow — trading one hollow for another. Add via
  `HAND_ACTION_EXECUTED_KEYWORDS` (NOT `HANDLED_KEYWORDS`, which would demand a handler
  and break the handler-key bidirectional drift test).
- **Extend the MVP coverage drift test.** Adding `dodge` to `MVP_KEYWORDS` fails the
  `every MVP_KEYWORD is handled directly, via reveal translation, or at recruit time`
  test unless it is extended to admit the `HAND_ACTION_EXECUTED_KEYWORDS` category. This
  edit is in scope and MUST land in the same commit.
- **Honest-partial on entangled lines.** Recognizing `dodge` makes a mixed hook that
  declares `dodge` + still-unsupported `unleash`/`undercover` (Twilight Ops' rider line)
  classify NOT hollow (the WP-257 mixed-hook rule). That is correct — the
  unleash/undercover gap is still reported by their STANDALONE lines. Do NOT special-case,
  suppress, or implement unleash/undercover.
- **Provenance additive.** Add `dodge → { wp:"WP-275", decision:"D-24051" }` to
  `scripts/coverage/mechanic-provenance.json` (new key only; existing keys byte-unchanged).

---

## Required `// why:` Comments
- At the `dodge` keyword (union + array): the printed Dodge ability; executable via the
  `dodgeCard` move, not an `onPlay` handler (D-24051).
- At `HAND_ACTION_EXECUTED_KEYWORDS` / the `MVP_KEYWORDS` add: `dodge` executes from a
  move, so it has no `HERO_EFFECT_HANDLERS` entry; membership marks it ledger-`executable`
  AND keeps the play-time-visited hook `applied`/not-hollow (prevents a `no-handler`
  regression) (D-24051).
- In `dodgeCard.ts`: at the stage + block-all gates (board-freeze consistency, D-24008 /
  D-24019); at the discard+draw (the printed "discard this card to draw another"; "ignore
  all other text" is automatic — the card is never played) (D-24051).
- At the `game.ts` registration: a non-core internally-gated move (the recruitHero
  pattern), NOT a core move (D-24051).
- (No `classifyHeroEffectReason` edit is needed — the `MVP_KEYWORDS` add alone yields the
  `applied` classification; the only test touch is the drift-test extension + the
  move-set assertion.)

---

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (`MVP_KEYWORDS` via `HAND_ACTION_EXECUTED_KEYWORDS`).
- `packages/game-engine/src/moves/dodgeCard.ts` — **new** (the move).
- `packages/game-engine/src/game.ts` — **modified** (register the move).
- `packages/game-engine/src/game.test.ts` — **modified** (move-set + count 11 → 12 + description).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/moves/dodgeCard.test.ts` — **new** (discard+draw, eligibility gates, ignore-other-text, log line, JSON-serializable).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (extend the MVP-coverage drift test for the hand-action category; play-time = no onPlay mutation + no hollow; `dodge ∈ MVP_KEYWORDS`; `HANDLED_KEYWORDS` count test unchanged).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- `scripts/coverage/hero-effect-coverage.baseline.json` — **regenerated**.
- `data/metadata/card-mechanics.json` — **regenerated** (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `dodge`).
- `scripts/hero-mechanic-ledger.mjs` — **modified** (extend the move-executor handler-module mapping for `dodge`).
- (NO `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`, `ai.legalMoves.ts`, or board-freeze guard.)
- Governance: `STATUS.md`, `DECISIONS.md` (D-24051), `WORK_INDEX.md` (WP-275 ✅), `EC_INDEX.md` (EC-306 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `data/cards/**`, `apps/**`, `packages/registry/**`,
`apps/server/**`, `packages/game-engine/src/simulation/ai.legalMoves.ts` MUST be byte-unchanged.

---

## After Completing
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` exit 0; no regression.
- [ ] Drift grep: `grep -c "dodge" rules/heroKeywords.ts` = 2; `game.test.ts` asserts exactly 12 moves incl. `dodgeCard` + green.
- [ ] MVP-coverage drift test extended (admits the hand-action category) + green; `HANDLED_KEYWORDS` handler-count test UNCHANGED (no handler added).
- [ ] Play-time guard test green: playing a dodge hero mutates no onPlay state and fires no hollow (neither `parse-unrecognized` nor `no-handler`).
- [ ] Honest fix proven: `dodgeCard({ cardId })` removes the card from hand, appends to discard, and draws one replacement; ineligible calls are silent no-ops.
- [ ] Ledger flip verified: `dodge` `executable` (all dodge lines/heroes) with handler `moves/dodgeCard.ts`; runtime-observed `dodge` 37 → 0.
- [ ] Four freshness gates pass: `ledger:heroes:check`, `sim:coverage --check`, `sim:runtime-observed:check`, `mechanics:metadata:check`.
- [ ] `git diff --name-only` → only the allowlist files; `git diff` empty for `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`, `ai.legalMoves.ts`. Provenance diff additive.
- [ ] Sentinel `finalStateHash` unchanged OR re-pinned per WP-236 (state which, with the scaffold evidence).
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-275 ✅).
- [ ] STATUS notes the D-24026 live-verify (the `/coverage` `dodge` flip) as pending post-deploy; the in-game affordance + the bot-dodge integration are deferred follow-ups.

---

## Close Notes Required in PR / Commit Body
- The measured ledger flip (dodge unsupported → executable count) + the runtime-observed 37 → 0.
- The scaffold result: the honest-fix proof (the dodge card leaves hand → discard, one replacement drawn), the ineligibility no-ops, and the "ignore other text" confirmation.
- The play-time path: confirmation that the onPlay dodge hook is visited at play time and is a not-hollow no-op (magnitude-gated skip + `MVP_KEYWORDS` `applied`), and that the MVP-coverage drift test was extended for the hand-action category.
- The move registration: `LegendaryGame.moves` count 11 → 12; `game.test.ts` move-set/count + description updated.
- Confirmation `data/cards/**` + `apps/**` + `packages/registry/**` + `apps/server/**` + `ai.legalMoves.ts` are byte-unchanged, the provenance diff is additive, and whether the sentinel was re-pinned.

---

## Common Failure Smells
- A `data/cards/**` line in the diff → re-marking is out of scope; the markers exist; revert.
- An `ai.legalMoves.ts` edit / a sentinel `finalStateHash` change → the bot started dodging; dodge is a registered-but-bot-unused move this WP; revert the legal-move edit and investigate the hash.
- A `game.test.ts` move-count still 11 (or unchanged) → the new move was registered without updating the drift assertion; it FAILS — update the set + count + description.
- The `onPlay` hollow vanished but `dodgeCard` never moves the card → a dishonest recognition; implement the move and prove it in the scaffold.
- `dodge` shows `deferred` not `executable` in the ledger → it was added to `HERO_KEYWORDS` but not `MVP_KEYWORDS`.
- `dodge` added to `HANDLED_KEYWORDS` or given a `HERO_EFFECT_HANDLERS` entry → it executes from a move, not play; enter `MVP_KEYWORDS` via the hand-action category with NO handler, and keep the handler-key bidirectional drift test unchanged.
- The MVP-coverage drift test left unextended → it FAILS for `dodge` (neither handled, reveal-translated, nor recruit-time); admit the hand-action category.
- Playing a dodge hero starts firing a `no-handler` hollow → `dodge` reached `HERO_KEYWORDS` but NOT `MVP_KEYWORDS`; membership is what keeps the play-time visit `applied`/not-hollow.
- A `hasPending*` guard ADDED, or a pending-choice queue → wall-crawl/dodge are NOT the interactive-choice subsystem; the move only RESPECTS the existing guards.
- A `sim:coverage`/ledger/runtime-observed freshness gate red → a coverage artifact was not regenerated in the same commit.
- The handler column for `dodge` shows `heroEffects.execute.ts#dodge` → the ledger move-executor handler-module mapping was not extended; it must resolve to `moves/dodgeCard.ts`.
