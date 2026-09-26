# EC-804 — Snarling Fangs Moonlight (Execution Checklist)

**Source:** docs/ai/work-packets/WP-767-snarling-fangs-moonlight.md
**Layer:** Game Engine (hero keyword, optional-KO scope, setup allowlist) + card data (one marker pair) + Arena Client (one prompt heading)

## Before Starting
- [ ] Baseline `origin/main` includes #2409. Run `pnpm install`, then `pnpm -r build` (expect 0). Engine and arena-client suites are green.
- [ ] Re-read the CURRENT keyword and handler count pins (72 / 56 at draft). If another keyword WP landed first, use the current values: joining the lockstep is the intent, not the literal.
- [ ] Anchors are still where the WP §Assumes says:
  - `DAY_NIGHT_UNMODELED_LINES` (Snarling Fangs present)
  - the `defeated-villain-or-mastermind` setup arm
  - `resolveDeferredHeroGrants` re-evaluating all conditions
  - `PendingOptionalKoReward.koZones`
  - the three `koZones` readers (resolve / projection / bot + selector)
  - the client no-reward heading
- [ ] Re-read WP §Operator decision (Moonlight timing). If the operator flipped it, STOP and re-draft.

## Locked Values (do not re-derive)
- **Keyword** `'optional-ko-your-hero'`: no magnitude, so it goes in `NO_MAGNITUDE_KEYWORDS`. Handler name: `heroEffectOptionalKoYourHero`.
- **Park:** `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','inPlay'], koHeroesOnly: true }`. Silent park. No eligible card → a log line and no park.
- **New field** `koHeroesOnly?: true` on `PendingOptionalKoReward`. Absent means no filter. When set, `WOUND_EXT_ID` is ineligible everywhere. Write `true` or omit it, **never `false`**; readers test `=== true`.
- **Heading test:** exact equality, `assert.equal(heading.trim(), 'You may KO a card')`. A regex like `/You may KO a card/` also matches the old heading.
- **Selector:** `selectDefaultOptionalKoTarget(zones, cardStats, isEligible = () => true, allowInPlay = true, allowDiscard = true)`. Scan order and tie-break are unchanged. `allowDiscard = false` skips the discard scan only.
- **Markers** on `mdns / werewolf-by-night / snarling-fangs`, `abilityIndex: 1`, in this order:
  1. `[keyword:defeated-villain-or-mastermind]`
  2. `[keyword:optional-ko-your-hero]`
- **Allowlist:** remove `'mdns/werewolf-by-night/snarling-fangs:moonlight'` from `DAY_NIGHT_UNMODELED_LINES`, leaving 8 entries.
- **Hook condition order:** `moonlightInEffect` before `defeatedVillainOrMastermindThisTurn`. A test pins it.
- **Client heading** (no-reward variant): `You may KO a card`.
- **Marker allowlist:** append `|^\[keyword:optional-ko-your-hero\]$` to `VALID_TOKEN_PATTERN` in `scripts/convert-cards/apply-hero-ability-markers.mjs`, after `day-night-both`. Without it the apply loud-fails.
- **Count pins** (read current values; 72 / 56 at draft):
  - `rules/heroKeywords.test.ts` length;
  - the `HERO_KEYWORDS.length` literal at `rules/heroAbility.setup.test.ts:~637`;
  - `setup/heroAbility.setup.test.ts:1430` (the X-Gene pin);
  - append the new value to the `expectedKeywords` array in `rules/heroAbility.setup.test.ts:636`;
  - the handler-count pins at `hero/heroEffects.execute.test.ts:122` and `:7145`.
- **Feed regen order:**
  1. marker apply
  2. `pnpm -r build`
  3. `ledger:heroes`
  4. `mechanics:metadata`
  5. `effect-index`
  6. `sim:runtime-observed`

  Commit only: `mdns.json`, `hero-mechanic-ledger.{json,csv}`, `card-mechanics.json`, `effect-implementation-index.json`, `runtime-observed-hollows.json`. **Never** `sim:coverage --update-baseline`.

## Guardrails
- No change to the D-24467 deferral rule or to fire-time condition re-evaluation. The Moonlight timing is the existing behaviour.
- Existing optional-KO entries (Radioactive Riot, Battlefield Promotion, rewarded entries) are byte-unchanged in projection, resolve and bot pick. Default parameters preserve them; a test asserts it.
- The bot never declines, and never emits a target the resolve rejects (no discard pick, no Wound). A hang is a failure. Three tests prove it:
  - a choice parked next to the fight's own choice resolves;
  - two Fangs copies plus one defeat → two first-in-first-out entries, both resolvable;
  - the projection ↔ resolve ↔ bot round trip agrees.
- All six keyword lockstep sites move together. `NO_MAGNITUDE_KEYWORDS` is the most-missed one, so a behaviour test proves the handler actually parks.
- Card data changes only through the marker pipeline (`apply-hero-ability-markers.mjs`), never by hand-editing `mdns.json`.
- Core `finalStateHash` / PAR oracles must not move. No sentinel or PAR fixture plays Werewolf by Night.
- Client copy lives only in `OptionalKoRewardPrompt.vue`. No new projection field for the heading.

## Required `// why:` Comments
- Keyword entry: "one of your Heroes" = hand + played this turn (rules v23 §3439), no reward (D-24600).
- Handler: `koZones ['hand','inPlay']` excludes discard; `koHeroesOnly` because a Wound is not a Hero.
- `koHeroesOnly` field: absent means no filter, so existing entries are unchanged.
- Each discard-scope reader (projection, bot, selector): mirrors the existing `inPlay` gate.
- Allowlist removal: Snarling Fangs' Moonlight line is now modelled by WP-767 / D-24600.
- Client heading: generic copy, because the zone labels already name each source.
- `VALID_TOKEN_PATTERN` entry: the new keyword token, WP-767 / D-24600.
- Self-KO test: Snarling Fangs may KO itself; the armed grant persists for the turn (keyed by card id).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` + `rules/heroKeywords.test.ts` — **modified**
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` + test — **modified**
- `packages/game-engine/src/types.ts` — **modified**
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` + test — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` + `ui/uiState.build.test.ts` — **modified**
- `packages/game-engine/src/simulation/ai.legalMoves.ts` + test — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** (`VALID_TOKEN_PATTERN`)
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `data/cards/mdns.json` — **modified / regenerated**
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` + test — **modified**
- `docs/ai/DECISIONS.md` (D-24600), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] Marker apply → "Updated: 2 lines", re-run → 0; `pnpm -r build` → 0.
- [ ] Regenerate in the locked order, then `cards:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `effect-index:check`, `sim:runtime-observed:check` (also the sim-hang regression gate), `sim:coverage --check` → 0.
- [ ] Engine suite passes; arena-client typecheck 0 and suite passes; `pnpm -r --no-bail test` → 0 fail.
- [ ] Core oracles unchanged.
- [ ] D-24600 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology (`EC-804:` then `SPEC:`).
- [ ] Live-verify (D-24026) recorded as a post-deploy STATUS flip.

## Common Failure Smells
- The ability "is waiting" under Sunlight: the condition order is reversed (the defeat condition comes first).
- Nothing parks on a defeat under Moonlight: the keyword was left out of `NO_MAGNITUDE_KEYWORDS`, or the allowlist entry was not removed.
- The sim hangs after a Snarling Fangs defeat: the bot selector still picks a discard card or a Wound.
- The prompt shows discard cards: the projection's discard list was not gated on `koZones`.
- A Riot or Battlefield Promotion bot pick changed: a default parameter changed existing behaviour.
- A `moonlight` hollow still records for Snarling Fangs: the feeds were not regenerated.
