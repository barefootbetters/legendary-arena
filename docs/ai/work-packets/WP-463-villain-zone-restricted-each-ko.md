# WP-463 — Villain Zone-Restricted Each-Player Hero KO (Juggernaut Ambush + Escape)

**User-Visible Surface:** the game log + KO pile — revealing Juggernaut now makes
each player KO two Heroes **from their discard pile** (Ambush), and Juggernaut
escaping makes each player KO two Heroes **from their hand** (Escape); both narrate
the KO'd heroes. Before this WP the printed Ambush did nothing and (post-D-24266)
only left an `unmarked-ability` breadcrumb — the last onAmbush hollow observed in a
live Magneto match (2026-07-30, `gitSha b685eff`).

**Closes the observed onAmbush hollow.** Juggernaut's *"Ambush: Each player KOs two
Heroes from their discard pile."* is a **source-zone-restricted** each-player KO —
the existing `ko-hero:each:N` (koHeroEachPlayerMag2) never covered it because its
resolver falls through discard → hand → inPlay, whereas Juggernaut is discard-only.

---

## Goal

After this session, a villain/henchman `[effect:ko-hero:each:<N>:<zone>]` marker
(zone ∈ `discard | hand`) makes **each player** KO up to `N` Heroes from **only the
named zone** — no discard→hand→inPlay fallback — at the marker's timing. Juggernaut
(core / brotherhood) is marked on both lines: `Ambush: … from their discard pile`
→ `[effect:ko-hero:each:2:discard]` and `Escape: … from their hand` →
`[effect:ko-hero:each:2:hand]`. The effect is **auto-resolved** (deterministic,
no player choice), reuses the existing each-player-KO per-target narration, and
records **no** `unmarked-ability` breadcrumb for the marked lines.

---

## Assumes

- **D-24266 ✅ (unmarked-timing-line breadcrumb).** A fired villain/henchman timing
  line with empty `effects` and no `unresolvedMarkers` records a `no-handler`
  `unmarked-ability` hollow. Giving the line a recognized descriptor removes the
  breadcrumb. Source: `docs/ai/DECISIONS.md` D-24266;
  `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **WP-202 / D-20201 ✅ (magnitude-N each-player KO).** The `ko-hero` primitive with
  `target: 'each'` + `magnitude` already KOs `magnitude` heroes per player via the
  shared resolver `koOneHeroForPlayer` (zone priority discard → hand → inPlay). This
  WP extends that `each` branch with an optional source-zone lock; it does NOT change
  the zone-less behavior. Source:
  `packages/game-engine/src/villain/villainEffects.execute.ts`;
  `packages/game-engine/src/rules/villainAbility.types.ts`.
- **WP-252 / D-24023 ✅ (parameterized villain-effect vocabulary).** The executor
  dispatches on `VillainEffectDescriptor`. A new *targeting variant* is a descriptor
  **param**, not a new primitive — so this WP adds an optional `zone` field to the
  descriptor and grammar, and `VILLAIN_EFFECT_PRIMITIVES` is **unchanged** (no
  primitive drift). Source: same file; `.claude/rules/code-style.md §Drift Detection`.
- **D-20602 / D-20603 ✅ (deterministic KO target selection).** `selectKoHeroTarget`
  picks the worst hero in a zone (starter S.H.I.E.L.D. first, then ext_id lex-asc;
  Wounds excluded — a Wound is not a Hero). The zone-locked resolver reuses it
  verbatim within the single named zone. Source: same file.
- **The card pipeline is multi-stage.** `[effect:]` markers are authored by
  `scripts/convert-cards/apply-effect-markers.mjs` from
  `scripts/convert-cards/inputs/villain-effect-markers.json`. The script keeps its
  OWN hand-synced grammar validator (`isValidParameterizedEffectToken`) that must
  learn the 4-token `ko-hero:each:N:zone` form. Source: `.claude/CLAUDE.md §Card Data`.
- **Only Juggernaut (core) is curatable under v1 discipline.** A corpus scan of every
  `Each player KOs … from their {discard,hand}` line (12 lines) shows all others
  carry an extra filter/choice clause (non-grey Heroes, reveal-gated, "choose a
  player", Wounds-only, cost-thresholded) and stay deferred — conservatism over
  coverage, matching the existing curation discipline. Only Juggernaut's two lines
  are unconditional + unfiltered. Source: `data/cards/*.json` (grep
  `Each player KOs.*from their`).
- **Baseline:** `origin/main` @ `b8d479df` (`git rev-parse origin/main` at draft
  time — the WP-461/462 legends-set-details SPEC merge). Ledger next-free confirmed
  WP-463 / EC-498 / D-24280.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline; §Zone & Pile Structure (zones
  store `CardExtId` strings only; mutate via `zoneOps.ts`); §Determinism (no
  `Math.random`, no I/O in effects).
- `.claude/rules/architecture.md` — Determinism (identical setup + moves replay
  identically); `.reduce()` forbidden in zone/effect application.
- `.claude/skills/legendary-game-engine/SKILL.md` — the villain-effect executor
  discipline, zone ops, `// why:` requirements for `ctx.random`.
- **Why now:** the D-24266 breadcrumb (shipped #1065) is doing its job — a live
  Magneto match (2026-07-30) surfaced Juggernaut's Ambush as the last onAmbush
  hollow after WP-447 (Doombot scry-KO) and WP-450 (gain-attached-hero) closed the
  onFight classes. This ships the mechanic behind the breadcrumb.
- **Design choice — extend `ko-hero`, do NOT add a primitive (locked, for review).**
  A source-zone restriction is a *targeting variant* of the existing each-player KO,
  which the D-24023 vocabulary models as a descriptor param, not a new primitive.
  Extending `ko-hero` with an optional `zone` (a) keeps `VILLAIN_EFFECT_PRIMITIVES`
  drift-free (no new primitive, no primitive-count test change), and (b) lets the
  zone-bearing descriptor reverse-map to the existing `koHeroEachPlayerMag2` keyword
  so it narrates per-target KO'd-hero names for free (WP-316) — no new narration
  path, the frozen 10-keyword surface (D-24023) untouched. A new
  `ko-hero-from-zone` primitive was rejected: it would add primitive drift AND need
  its own self-narration (the scry-ko `pushLog` path) for no benefit.
- **Escape sibling included (single mechanic).** Juggernaut's `Escape: … from their
  hand` is the identical mechanic differing only by zone; marking it is one extra
  curated line and closes the sibling hollow in the same WP rather than leaving it
  for a follow-on. The WP title names Ambush because that is the observed live
  hollow; the mechanic is timing-agnostic.

---

## Scope (In)

- Add an optional `zone?: 'discard' | 'hand'` field to `VillainEffectDescriptor`
  (`villainAbility.types.ts`). `VILLAIN_EFFECT_PRIMITIVES` union + array **unchanged**.
- `descriptorKey` (the reverse-map key builder) is **NOT** extended with `zone` —
  see Contract. A zone-bearing `ko-hero:each:N` descriptor reverse-maps to the same
  legacy keyword as its zone-less sibling (`koHeroEachPlayer` / `koHeroEachPlayerMag2`)
  so it narrates identically.
- Extend `parseParameterizedEffect` (setup): accept `ko-hero:each:<N>:<zone>`
  (4 tokens, zone ∈ `discard | hand`) → `{ primitive: 'ko-hero', target: 'each',
  magnitude: N, zone }`. `ko-hero:each:<N>` (3 tokens) is unchanged. A bad zone token
  or a 5th token → `null`.
- New executor resolver `koHeroesFromZoneForPlayer(G, playerId, zone, magnitude)`:
  KO up to `magnitude` heroes from **only** `zones[zone]` (reusing `selectKoHeroTarget`
  each iteration; Wounds excluded), collecting the KO'd ext_ids. No fallback to other
  zones. Reachable no-op when the zone has fewer than `magnitude` heroes (or none).
  Wired into the `villainEffectKoHero` `target: 'each'` branch: when
  `descriptor.zone` is set, iterate players (sorted) and call the zone-locked
  resolver; otherwise the existing `koOneHeroForPlayer` (unchanged).
- Add the 4-token `ko-hero:each:N:zone` grammar to the marker script's local
  `isValidParameterizedEffectToken` (`apply-effect-markers.mjs`).
- Mark Juggernaut (core / brotherhood) via `villain-effect-markers.json`:
  `ambush: ["ko-hero:each:2:discard"]`, `escape: ["ko-hero:each:2:hand"]`; regenerate
  onto `data/cards/core.json` via `apply-effect-markers.mjs`.

## Scope (Out)

- **Any filtered/conditional zone-restricted KO** (non-grey Heroes, reveal-gated,
  "choose a player", cost-thresholded, Wounds-only). All 10 other corpus lines carry
  such a clause and stay deferred (their existing breadcrumbs/deferrals are correct).
- **The co2e Juggernaut sibling** (`co2e-villain-brotherhood-of-mutants-juggernaut`,
  `data/cards/co2e.json`) whose Ambush reads *"KOs a **non-grey** Hero from their
  discard pile"* — a class-filtered variant that stays deferred under the non-grey
  deferral above. Only **core** Juggernaut is marked; the co2e Juggernaut's
  `(unmarked)` villain-ledger row is **expected and is not churn** (see Verification 3).
- **A zone restriction on `target: 'current'`.** No current-player zone-restricted KO
  exists in the corpus; the `zone` param is honored only on the `each` branch.
- **`inPlay` as a restrictable zone.** Only `discard` and `hand` appear in printed
  "from their …" text; the grammar admits exactly those two.
- **Interactive KO choice for the each-player path.** The each-player KO is and stays
  auto-resolved (D-18902); only the current-player KO is interactive (WP-242).
- **Juggernaut's VP/attack or any other card's text.** Only the two Juggernaut effect
  markers are added.

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — add
  optional `zone` to `VillainEffectDescriptor` + doc; `descriptorKey` unchanged (why:
  comment noting the deliberate omission).
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** —
  `parseParameterizedEffect` accepts `ko-hero:each:N:zone`.
- `packages/game-engine/src/setup/villainAbility.setup.test.ts` — **modified** —
  parse accepts `:discard`/`:hand`, rejects bad zone / 5-token.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** —
  `koHeroesFromZoneForPlayer` resolver + zone branch in `villainEffectKoHero`.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** —
  zone-locked KO (discard-only / hand-only, no fallback), magnitude cap, reachable
  no-op, per-target narration, Juggernaut no-breadcrumb.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — grammar accepts
  the 4-token `ko-hero:each:N:zone`.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** —
  Juggernaut curated `ambush` + `escape` entries.
- `data/cards/core.json` — **modified (generated)** — the two appended markers (via
  the script; do not hand-edit).
- **Conditional (determinism):** the regenerated
  `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` (Juggernaut rows flip to
  `ko-hero` executable), and — only if a record-game/replay fixture reveals or
  escapes Juggernaut — that fixture + its pinned `finalStateHash` (Verification 4).

---

## Contract

- **Descriptor:** `VillainEffectDescriptor` gains optional `zone?: 'discard' | 'hand'`.
  Present only on `{ primitive: 'ko-hero', target: 'each' }` descriptors in v1.
- **Marker grammar:** `ko-hero:each:<N>:<zone>` with `N ≥ 1` and `zone ∈ {discard,
  hand}`. Parser and the marker script's validator both accept exactly this 4-token
  form (plus the unchanged 3-token `ko-hero:each:<N>`); any other token count or a bad
  zone → reject.
- **`descriptorKey` deliberately EXCLUDES `zone`.** So `{ …, magnitude: 2, zone:
  'discard' }` and `{ …, magnitude: 2 }` share one key and both reverse-map to
  `koHeroEachPlayerMag2`. The zone param is a *resolver-targeting* detail invisible to
  the keyword narration surface — the effect narrates as the generic each-player KO
  with per-target KO'd-hero names (WP-316). This keeps the frozen 10-keyword surface
  (D-24023) and the injective round-trip test unchanged.
- **Resolver:** `koHeroesFromZoneForPlayer` KOs from `zones[zone]` only, `magnitude`
  times, `selectKoHeroTarget` each iteration (Wounds excluded, starter-first then
  lex-asc), returning the KO'd ext_ids in KO order. No cross-zone fallback. Empty /
  short zone → fewer (or zero) KOs, a reachable no-op (never hollow).
- **Determinism:** no `ctx.random.*` / `Math.random` / I/O. Player iteration is
  `Object.keys(G.playerZones).sort()` (D-18902). Given identical zones the KO set and
  post-state are identical.
- **No new `G` field.** Mutates only `G.playerZones[*].{discard,hand}` and `G.ko` via
  existing helpers.

---

## Acceptance Criteria

1. `parseParameterizedEffect('ko-hero:each:2:discard')` → `{ primitive: 'ko-hero',
   target: 'each', magnitude: 2, zone: 'discard' }`; `…:hand` → zone `'hand'`;
   `ko-hero:each:2` → zone-less (unchanged); `ko-hero:each:2:inPlay` → `null`;
   `ko-hero:each:2:discard:x` → `null`.
2. `VILLAIN_EFFECT_PRIMITIVES` is **unchanged** (still 7 entries); the primitive
   drift test is untouched and passes.
3. Zone-locked resolver: over a player with discard `['pile-wound',
   'starting-shield-agent', 'core/x/hero#0']` and a non-empty hand, a
   `ko-hero:each:2:discard` KOs `starting-shield-agent` then `core/x/hero#0` from
   **discard** (Wound excluded, starter-first), KOs **nothing from hand**, and returns
   both ext_ids as targets.
4. Magnitude cap + reachable no-op: `:discard` with magnitude 2 over a 1-hero discard
   KOs that one hero and stops (no fallback); over an empty discard KOs nothing and
   records **no** hollow record.
5. Each-player: a `ko-hero:each:2:discard` hook KOs from **every** player's discard
   (sorted order), not just the current player's.
6. Juggernaut's `data/cards/core.json` Ambush line carries
   `[effect:ko-hero:each:2:discard]` and Escape carries `[effect:ko-hero:each:2:hand]`;
   revealing Juggernaut records **no** `unmarked-ability` breadcrumb (D-24266
   regression closed) and moves ≥1 discard hero (when present) to `G.ko`.
7. Narration: the zone-restricted KO records a `koHeroEachPlayerMag2` result with the
   KO'd hero ext_ids as targets (per-target names via WP-316) — no new keyword, no
   change to `EFFECT_KEYWORD_LABELS` / `notableEvents` / the injective round-trip test.
8. **Escape/hand no-crossover (direction mirror):** `ko-hero:each:2:hand` over a
   player with heroes in **both** discard and hand KOs two from **hand only** and
   leaves the discard **byte-unchanged**. (Pins the direction: the legacy resolver
   checks discard first, so a naive zone-lock could still drain discard on the Escape
   line while every other AC still passed.)
9. **Reverse-map unit assertion (guards the narration decision):**
   `descriptorToLegacyKeyword({ primitive: 'ko-hero', target: 'each', magnitude: 2,
   zone: 'discard' }) === 'koHeroEachPlayerMag2'` — a unit test in
   `villainAbility.types.test.ts` so a future `descriptorKey` regression (adding `zone`
   to the key) fails at the unit boundary, not only in the AC-7 integration test.
10. `pnpm --filter @legendary-arena/game-engine build` + `test` green; card-data +
    registry + villain-ledger CI gates green after regen; hash oracles unchanged OR
    regenerated-with-note (Verification 4).

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Regenerate markers: run `apply-effect-markers.mjs`; confirm exactly the two
   Juggernaut lines (core Ambush + Escape) gained a marker (`git diff data/cards/`),
   no unrelated churn (judge by `--numstat` / `--ignore-all-space`, per the CRLF trap).
3. Registry validate + `pnpm ledger:villains` (regenerate) + `:check`, plus
   `mechanics:metadata:check` / `sim:runtime-observed:check` green. The ledger diff
   flips **core** Juggernaut's Ambush + Escape rows to `ko-hero` executable; the
   **co2e** Juggernaut row stays `(unmarked)` (its non-grey-filtered Ambush is
   deferred — expected, not churn).
4. **Determinism:** marking makes Juggernaut apply a real hashed KO, so a hash oracle
   shifts IFF a pinned/golden/sentinel fixture reveals or escapes Juggernaut. Run the
   game-engine suite: expected green with NO re-pin (Juggernaut is not in the core
   sentinel fixtures); if any replay/sentinel hash test fails, a fixture DOES exercise
   Juggernaut → regenerate + re-pin with a note. Do NOT assume; confirm empirically.
5. Live-verify (D-24026): in a driven match where Juggernaut enters the city, the log
   shows each player KO'ing two heroes from their discard and NO `Unhandled effect
   observed` line.

---

## Definition of Done

- [ ] All 8 Acceptance Criteria pass.
- [ ] `VillainEffectDescriptor` gains `zone`; `VILLAIN_EFFECT_PRIMITIVES` and its drift
      test are untouched (no primitive added); `descriptorKey` deliberately omits `zone`
      with a `// why:` comment.
- [ ] Juggernaut markers regenerated onto core via the script (not hand-edited), after
      the marker-script grammar learns the 4-token form; no unrelated card-data churn.
- [ ] Game-engine build + test green; card-data + registry + villain-ledger CI gates green.
- [ ] Determinism: replay/fixture hash either unchanged or regenerated-with-note.
- [ ] `D-24280` landed (Active) documenting the `zone` param + narration-reuse decision.
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md`
      node `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine) + the card-data pipeline (generated
  artifact, not a layer). No cross-layer import. PASS.
- **§ Determinism / persistence:** no `ctx.random`, no I/O, no new `G` field; KO
  mutation via `zoneOps`. Determinism-adjacent (real hashed KO) → Verification 4 pins
  the replay-hash handling. PASS.
- **§ Contract / drift:** an optional descriptor field + a grammar extension; **no new
  primitive**, so the `VILLAIN_EFFECT_PRIMITIVES` drift test is untouched. The
  `descriptorKey`-omits-`zone` decision is locked in Contract + D-24280. PASS.
- **§ Contract Files (`code-style.md`):** `villainAbility.types.ts` is a `.types.ts`
  contract file (locked; change requires Architecture review + a DECISIONS entry). The
  change is **additive and backward-compatible** — `zone` is optional, so every existing
  descriptor and all existing card data are unchanged and **no migration is needed**;
  the DECISIONS half is D-24280 (same-file precedent: WP-447/D-24267, WP-450/D-24270).
  PASS.

**Gate verdicts (recorded inline per 01.0a Step 5):**
- **Pre-flight (01.4):** `READY TO EXECUTE` (independent subagent, no blocking PS-items;
  concretely verified the `descriptorKey`-omits-`zone` → `koHeroEachPlayerMag2`
  reverse-map). Its RS-items are folded in: AC-9 (the reverse-map unit assertion) and
  the EC type-precision note (descriptor `zone` is `'discard' | 'hand'`, narrower than
  `KoHeroTarget.zone`).
- **Copilot (01.7):** `RISK`, concerns resolved in-place: (1) AC-8 added (Escape/hand
  no-crossover direction mirror); (2) the co2e Juggernaut deferred-sibling disclosure
  (Scope Out + Verification 3); (3) this §Contract Files citation. No scope, allowlist,
  or mutation-boundary change — pre-flight `READY` stands.
- **§ Canonical field names:** reuses `discard` / `hand` zone names and the
  `pile-wound` / `starting-shield-*` closed enums; the new field is `zone`, a
  **narrower** union `'discard' | 'hand'` (NOT `KoHeroTarget.zone`, which also admits
  `'inPlay'` — the executor must not reuse that type for the descriptor field). PASS.
- **§ Scope closed:** In/Out enumerated; filtered variants, `current`-target zone,
  `inPlay`, and interactive choice explicitly Out. PASS.
- **§17 gameplay fidelity:** implements printed text faithfully (discard-only /
  hand-only, magnitude 2, Wounds-not-Heroes). No conflict.
- **§20 N/A** — no funding surface. **§21 N/A** — no `apps/server` endpoint or
  catalogued library-only function.
- Remaining sections: PASS / N/A as recorded in the commit body.
