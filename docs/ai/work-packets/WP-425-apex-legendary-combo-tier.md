# WP-425 — Apex `LEGENDARY!` Combo Tier (4th shared `comboTierForCount` boundary + audio sting)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; **zero engine / determinism / persistence footprint** (the combo cue is pure presentation per ARCHITECTURE.md "engine owns truth; UI consumes read-only projections"). Also updates the ewiki **contract documentation** (design-reference markdown, no runtime layer).
**Dependencies:** WP-413 / D-24228 (the shipped tiered combo cue: `comboTierForCount`, `ComboTier`, `comboCueManifest`, `useComboCue`, and the WP-412 engine's lazy-load — the exact surface this WP extends), WP-409 / D-24221 (`UIState.game.lastPlayEffectsFired` — the scalar the tier scales on), WP-412 / D-24224 (the audio engine + the `PlayViewport` `01.5` host). All landed on `main`.
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `0c129ae6` (WP-423 SPEC draft merged, PR #1006). Re-baseline to current `origin/main` at execution.

---

## Goal

After this session, `comboTierForCount` gains a **fourth boundary** — an apex
`legendary` tier at `count >= 5` — so a very large hero-ability chain plays a
distinct, rarer **`LEGENDARY!` combo sting** on `play.legendary-arena.com`,
above the existing `big` tier (which narrows to `3–4`). The change is the
minimal extension of the shipped WP-413 surface: `ComboTier` gains
`'legendary'`, `comboTierForCount` maps `>= 5 → 'legendary'` (and `3–4 → 'big'`),
and `comboCueManifest` maps the new tier to a CC0 clip (`combo-legendary.mp3`,
hosted on R2). The existing `useComboCue` consumer needs **no change** — it
plays whatever audible tier the pure function returns. The new boundary is
locked by **D-24246** as the **fourth shared tier of the Combo Tier Contract**,
consumed identically by the audio layer (this WP) and the future visual
combo-flash / synergy call-out layer (not yet built) — never a visual-only or
audio-only threshold. The ewiki Combo Tier Contract and the narrative synergy
call-out ladder are updated in lockstep so the documented contract matches the
code. No engine change, no new dependency, no new audio control, no new
`UIState` field.

---

## User-Visible Impact

Players who pull off a **big** synergy chain (five or more hero-ability effects
in one play) hear a distinct, rarer **apex sting** — the audible payoff for the
game's own brand word, `LEGENDARY!`. It sits above the existing three-tier
escalation (`small → medium → big`), so the very best plays now sound bigger
than a merely good one, deepening the "I built this" reward the tiered combo cue
already delivers. It rides the same single SFX channel — the existing mute
toggle silences it and the volume slider scales it (no new control). Nothing
plays before the first user gesture unlocks audio (the WP-412 arm) or while
muted. (The matching **visual** `LEGENDARY!` call-out is a future WP — the VFX
layer is not built yet — but it will inherit this same locked tier boundary.)

---

## Assumes

- `apps/arena-client/src/audio/comboCueManifest.ts` (WP-413 / D-24228) exports
  `ComboTier = 'none' | 'small' | 'medium' | 'big'`, the pure
  `comboTierForCount(count: number): ComboTier` (`<= 0 → none`, `1 → small`,
  `2 → medium`, `>= 3 → big`), and
  `comboCueManifest: Record<Exclude<ComboTier, 'none'>, string>` mapping the
  three audible tiers to CC0 clip URLs under
  `https://images.legendary-arena.com/audio/sound-effects/` (`combo-small.mp3`,
  `combo-medium.mp3`, `combo-big.mp3`). The `Record<Exclude<…>, string>` type is
  a compile-time exhaustiveness pin (adding a tier to the union fails `vue-tsc`
  until it is mapped).
- `apps/arena-client/src/composables/useComboCue.ts` (WP-413) plays
  `comboCueManifest[tier]` for any `tier !== 'none'` via the injected
  `getAudioEngine()`; it is **tier-agnostic** and needs no change for a new tier.
- The WP-412 engine's `play(clipUrl)` **lazily loads** any un-preloaded URL
  (EC-448 amendment) — so a new combo clip needs **no** `audioEngine.ts` change.
- `UIState.game.lastPlayEffectsFired: number` (WP-409 / D-24221) is a public
  scalar, reset to `0` in the play-phase `onBegin`, overwritten per play, and
  **unbounded above** — so `count >= 5` is reachable.
- `apps/arena-client` uses Vue 3 + `node:test`; the combo tests are asset-independent (mocked `Howl` / injected engine).
- `wiki/visual-effects.md` carries the **Combo Tier Contract** (`{#combo-tier-contract}`), the Surface-2 tier table, the synergy call-out ladder, and the "Combo scaling beyond T3" open item — the design source that already scopes this apex rung at `>= 5`. `wiki/narrative-psychology.md` carries the synergy call-out ladder with `LEGENDARY!` as the **reserved apex**.
- `pnpm -r build` exits 0; the arena-client suite + `typecheck` (vue-tsc) pass on the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/audio/comboCueManifest.ts` — the exact surface to
  extend: the `ComboTier` union, the pure `comboTierForCount`, and the
  `comboCueManifest` Record (the compile-time exhaustiveness pin).
- `apps/arena-client/src/audio/comboCueManifest.test.ts` — the boundary + drift
  test to extend (its local `AUDIBLE_TIERS` array + the `Object.keys` equality
  assertion is the union↔map drift pin).
- `apps/arena-client/src/composables/useComboCue.test.ts` — the consumer test;
  its integration case drives count `5` and currently expects
  `comboCueManifest.big` — it must expect `comboCueManifest.legendary`.
- `apps/arena-client/src/composables/useComboCue.ts` — read only to confirm the
  consumer is tier-agnostic (plays `comboCueManifest[tier]` for any audible
  tier); it must NOT change.
- `docs/ai/DECISIONS.md` — **D-24228** (the shipped 3-tier combo cue this
  amends), **D-24221** (the `lastPlayEffectsFired` signal), and the reserved
  **D-24246** at the tail of this WP.
- `wiki/visual-effects.md` — the **Combo Tier Contract** (`{#combo-tier-contract}`),
  the Surface-2 tier table, the synergy call-out ladder + apex note, and the
  "Decisions Pending → Combo scaling beyond T3" item this WP resolves.
- `wiki/narrative-psychology.md` — the synergy call-out ladder (§"Synergy
  call-outs — naming the chain"): `LEGENDARY!` as the reserved apex.
- ewiki [Visual Effects → Combo Tier Contract](https://ewiki.legendary-arena.com/visual-effects/) — the "may not diverge" rule this WP obeys (one `comboTierForCount`, both renderers).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. **No** diffs, **no** snippets, **no** "show only the changed section."
- ESM only; Node v22+; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- The combo cue stays **pure presentation**: it reads `UIState` only, **never**
  writes `G`/`ctx`, never affects move validation, never branches engine logic.
  Determinism, replays, and bot-vs-bot sims are unaffected (none render audio).
  If a `packages/game-engine/**` file appears in the diff, STOP — out of scope.
- **Extend, do not rebuild.** Add the `legendary` tier to the **existing**
  `comboCueManifest.ts` surface. **No** new module, **no** new engine, **no** new
  `Howl` wrapper, **no** new audio control, **no** second SFX channel. `useComboCue.ts`
  does **not** change (it is tier-agnostic). `audioEngine.ts` does **not** change
  (the EC-448 lazy-load already plays any URL).
- **Tier mapping (locked, extends D-24228).** `comboTierForCount(count)`:
  `count <= 0 → 'none'`, `1 → 'small'`, `2 → 'medium'`, `3–4 → 'big'`,
  `count >= 5 → 'legendary'`. A pure function; four audible tiers plus a silent
  floor. The `big` upper edge narrows from open-ended to `4`.
- **Update both together (union ↔ map).** Adding `'legendary'` to the `ComboTier`
  union WITHOUT adding it to `comboCueManifest` fails `vue-tsc` at the
  `Record<Exclude<ComboTier, 'none'>, string>` pin; adding it to the manifest
  without the union also fails. Both change in the same file, plus the
  `AUDIBLE_TIERS` drift test.
- **Shared tier, not audio-only (D-24246).** The `>= 5 → legendary` boundary is
  the **fourth tier of the Combo Tier Contract**, locked for **both** the audio
  sting (this WP) and the future visual combo-flash / synergy call-out
  (`LEGENDARY!`). The contract documentation (`wiki/visual-effects.md` +
  `wiki/narrative-psychology.md`) is updated in the same session so the
  documented contract matches the code — never a code-only or doc-only change.
- **Audio bytes are hosted, not committed.** The apex clip
  `combo-legendary.mp3` lives on R2 under `audio/sound-effects/` (served via
  `images.legendary-arena.com`); the manifest references it by absolute URL. **No
  audio in git.** Sourcing / encoding / uploading the clip is an operator step
  (Out of Scope), gated by the live-on-surface verification.
- **CC0-first licensing.** The clip is CC0, no attribution.
- No new engine event, no `G` field, no `UIState` change — the layer consumes the existing WP-409 projection.

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **Tier type:** `ComboTier = 'none' | 'small' | 'medium' | 'big' | 'legendary'`.
- **Tier thresholds:** `<= 0 → none`, `1 → small`, `2 → medium`, `3–4 → big`, `>= 5 → legendary`.
- **New manifest key:** `legendary` → `${COMBO_BASE_URL}combo-legendary.mp3` (hyphenated filename, `audio/sound-effects/` prefix on `images.legendary-arena.com`).
- **No new dependency / engine / control / channel;** `useComboCue.ts` and `audioEngine.ts` unchanged.
- **Signal source:** `UIState.game.lastPlayEffectsFired` (public scalar, unbounded above; safe `?? 0`).
- **Reserved decision:** **D-24246** (the fourth shared tier; land Active at execution).

---

## Scope (In)

### A) Tier model + manifest (`apps/arena-client/src/audio/comboCueManifest.ts`, **modified**)
- Extend `ComboTier` to `'none' | 'small' | 'medium' | 'big' | 'legendary'`.
- Extend `comboTierForCount`: `<= 0 → none`, `1 → small`, `2 → medium`,
  `3–4 → big`, `>= 5 → legendary` (the `big` branch narrows from `return 'big'`
  to `if (count <= 4) return 'big'; return 'legendary';`).
- Add `legendary: ${COMBO_BASE_URL}combo-legendary.mp3` to `comboCueManifest`
  (now four audible tiers). Update the module JSDoc header (four tiers, not
  three) and the `// why:` comment set.

### B) Tier + manifest drift test (`apps/arena-client/src/audio/comboCueManifest.test.ts`, **modified**)
- Add boundary cases: `4 → 'big'`, `5 → 'legendary'`, and a larger value (`12 → 'legendary'`); keep `3 → 'big'`.
- Add `'legendary'` to the local `AUDIBLE_TIERS` array so the `Object.keys(comboCueManifest)` exact-equality drift assertion covers all four audible tiers; assert `legendary` maps to a non-empty `audio/sound-effects/` URL; keep `'none' in comboCueManifest === false`.

### C) Consumer test (`apps/arena-client/src/composables/useComboCue.test.ts`, **modified**)
- Update the existing integration case that drives count `5`: it must now expect `comboCueManifest.legendary` (not `.big`).
- Add a case proving `useComboCue` plays the apex clip on an audible value-change to a `>= 5` count (the consumer is unchanged; this pins that the new tier flows through it).

### D) Contract-documentation reflection (ewiki, **required by the may-not-diverge rule**)
- `wiki/visual-effects.md` — **modified**: add the fourth row (`>= 5` → apex/`legendary`) to the **Combo Tier Contract** table and the Surface-2 tier table; move the synergy call-out `LEGENDARY!` rung from "reserved apex" to a **locked** tier; resolve the "Decisions Pending → Combo scaling beyond T3" item (cite D-24246); keep the visual call-out framed as the future consumer of the now-locked tier.
- `wiki/narrative-psychology.md` — **modified**: in the synergy call-out ladder, mark the `LEGENDARY!` apex as a **locked** tier (`>= 5`) rather than reserved (cite D-24246, and the shared Combo Tier Contract).

---

## Out of Scope

- **The visual combo-flash / synergy call-out renderer** (the on-screen
  `LEGENDARY!` label / apex burst) — **the VFX layer is not built in code**
  (it is design/mock-only in the ewiki). This WP locks the shared tier so that
  layer inherits it, and ships the **audio** sting only. Building the visual
  consumer is a separate, larger WP.
- **Any engine change** — no new `G` field, no new `UIState` field, no
  `NotableGameEvent` variant, no change to WP-409's `lastPlayEffectsFired`
  semantics, and no re-pin of any `finalStateHash` sentinel.
- **A new audio dependency, engine, control, or channel** — the apex sting
  reuses the WP-412 engine, the `AudioControls`, and the single SFX channel;
  `useComboCue.ts` and `audioEngine.ts` are untouched.
- **Audio asset production** — sourcing / encoding / uploading `combo-legendary.mp3`
  to R2 is an operator/ops step (the code + tests are asset-independent via a
  mocked `Howl` / injected engine); live-on-surface verification depends on the
  clip being present.
- **A fifth tier or any re-tiering of `1/2/3–4`** — only the `>= 5` apex is
  added; `small`/`medium` are unchanged and `big` only narrows its upper edge.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

**Arena-client runtime + tests (App layer):**
- `apps/arena-client/src/audio/comboCueManifest.ts` — **modified** — add `'legendary'` to `ComboTier`, the `>= 5` branch to `comboTierForCount`, and the `legendary → combo-legendary.mp3` manifest entry
- `apps/arena-client/src/audio/comboCueManifest.test.ts` — **modified** — `4 → big`, `5/12 → legendary` boundaries + `'legendary'` in `AUDIBLE_TIERS` (drift pin)
- `apps/arena-client/src/composables/useComboCue.test.ts` — **modified** — the count-`5` case expects `comboCueManifest.legendary`; add an apex-plays case

**Contract documentation (ewiki markdown — no runtime layer):**
- `wiki/visual-effects.md` — **modified** — fourth row in the Combo Tier Contract + Surface-2 tables; `LEGENDARY!` rung locked; resolve the "Combo scaling beyond T3" pending item (cite D-24246)
- `wiki/narrative-psychology.md` — **modified** — synergy call-out ladder: `LEGENDARY!` apex marked locked (`>= 5`, cite D-24246)

`apps/arena-client/src/composables/useComboCue.ts` and
`apps/arena-client/src/audio/audioEngine.ts` are **NOT** in scope (tier-agnostic
consumer; lazy-load already handles any URL). No other files may be modified.
This WP declares **no** `01.5` runtime-wiring file — the wiring host
(`PlayViewport.vue`) already mounts `useComboCue` and needs no change.

---

## Contract

- `comboTierForCount(count: number): ComboTier` — pure, total over the integers:
  `<= 0 → 'none'`, `1 → 'small'`, `2 → 'medium'`, `3–4 → 'big'`, `>= 5 → 'legendary'`.
- `ComboTier = 'none' | 'small' | 'medium' | 'big' | 'legendary'`.
- `comboCueManifest: Record<Exclude<ComboTier, 'none'>, string>` — four audible
  tiers, each a non-empty `https://images.legendary-arena.com/audio/sound-effects/…`
  URL; `'none'` absent.
- **Combo Tier Contract (locked, D-24246 extends D-24228):** the count → tier
  mapping is shared by the audio and (future) visual renderers and **may not
  diverge**; the boundaries are `1 / 2 / 3–4 / >= 5`; a fifth tier would be a
  further `DECISIONS.md` change adding it for both layers at once.

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
multiplayer sync, no card-data/content-semantics change, no RNG. **Monetization
note (NG-1..7):** audio is a retention / perceived-quality lever, not a revenue
vector — the apex combo sting never gates play and never becomes pay-to-win (a
future cosmetic "sound pack" would be an optional flourish only). **Determinism
note (§22):** the combo cue is pure client presentation — it reads `UIState`,
never writes `G`/`ctx`, and adds **zero** engine / determinism / replay footprint
(sims and replays render no audio; no `finalStateHash` sentinel is touched). The
`lastPlayEffectsFired` signal it scales on is already observability-only and
hash-excluded (WP-409 / D-24221). NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy is added or proposed
(the WP touches a client audio tier and its design-reference documentation only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
layer consumes the boardgame.io `UIState` push and fetches a static R2 clip.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `comboTierForCount` maps `<= 0 → 'none'`, `1 → 'small'`, `2 → 'medium'`,
      `3` and `4 → 'big'`, `5` and above `→ 'legendary'`; the drift test pins all
      five boundary regions (incl. `3 → big`, `4 → big`, `5 → legendary`).
- [ ] `ComboTier` is `'none' | 'small' | 'medium' | 'big' | 'legendary'`.
- [ ] `comboCueManifest` maps **all four** audible tiers (`small`, `medium`,
      `big`, `legendary`) to a non-empty `audio/sound-effects/` URL, with
      `legendary → combo-legendary.mp3`; the `AUDIBLE_TIERS` / `Object.keys`
      drift test fails if any tier is unmapped or extra.
- [ ] `useComboCue` plays `comboCueManifest.legendary` on an audible value-change
      to a `>= 5` count; the prior behaviors (catch-up, no cue on `→ 0/none`,
      coalescing, re-arm across a per-turn reset, mute-respecting) are unchanged.
- [ ] `useComboCue.ts` and `audioEngine.ts` are **not** modified
      (`git diff --name-only` shows neither); no new dependency / engine /
      control / channel is added.
- [ ] The layer writes no `G`/`ctx` and adds no engine/determinism footprint
      (App-only runtime diff; engine suites + sentinel hashes untouched — no
      `packages/game-engine/**` file in the diff).
- [ ] The ewiki Combo Tier Contract (`wiki/visual-effects.md`) and the narrative
      synergy call-out ladder (`wiki/narrative-psychology.md`) show the fourth
      `>= 5 → legendary`/`LEGENDARY!` tier as **locked** (not reserved), citing
      D-24246 — the documented contract matches the code.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass (Howl mocked / engine injected; no real audio).
# The Record<Exclude<ComboTier,'none'>,string> pin fails typecheck if 'legendary'
# is added to the union but not the manifest.

# Step 3 — four audible tiers present, apex mapped to the hyphenated clip
Select-String -Path "apps\arena-client\src\audio\comboCueManifest.ts" -Pattern "legendary|combo-legendary"
# Expected: the 'legendary' tier in the union + comboTierForCount + manifest,
# mapped to combo-legendary.mp3

# Step 4 — no engine footprint, tier-agnostic consumer untouched
git diff --name-only
# Expected: only apps/arena-client/src/audio/comboCueManifest.{ts,test.ts},
# apps/arena-client/src/composables/useComboCue.test.ts, wiki/visual-effects.md,
# wiki/narrative-psychology.md (+ governance). NO useComboCue.ts, NO audioEngine.ts,
# NO packages/game-engine/** file.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
      D-24026):** in a **real deployed match**, a hero play that fires **5+**
      synergy effects plays the apex `combo-legendary.mp3` sting (distinct from
      `combo-big.mp3`); a 3–4-effect play still plays `big`; the mute toggle
      silences it — observed on the deployed bundle (requires `combo-legendary.mp3`
      uploaded to R2; green tests + merge alone do NOT satisfy it). If a natural
      5+ chain is impractical to reach, driving `lastPlayEffectsFired` directly on
      the fixture route (as EC-448 did) with the clip fetched status 200 in tier
      order satisfies the audio-side check; the upstream count is WP-409's concern.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the apex `legendary` combo tier (`>= 5`) rides
      the WP-412 engine + WP-409 signal; note the R2-clip prerequisite if pending.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24246** as Active (the fourth
      shared Combo Tier Contract tier).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-425 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-460 flipped to `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-425 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (the visual renderer, engine change, new dep/engine/control/channel, asset production, re-tiering).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Node v22+, 00.6) + packet-specific + session protocol + locked values.
- **§3 Assumes** — PASS. The WP-413 surface (exact exports/paths), the tier-agnostic consumer, the EC-448 lazy-load, the WP-409 unbounded scalar, and a green baseline.
- **§4 Context (Read First)** — PASS. Specific files (the manifest, its drift test, the consumer test, the tier-agnostic consumer) + D-24228/D-24221 + the two ewiki contract docs. No `00.2` reference: no card-data / setup-field change (a client presentation tier + its design docs).
- **§5 Files** — PASS. 5 content files (3 arena-client + 2 ewiki docs), bounded, no `01.5` wiring file; each entry marked modified with a one-line description; no ambiguous "update this section" language.
- **§6 Naming** — PASS. `comboTierForCount`, `ComboTier`, `comboCueManifest`, `legendary`, `combo-legendary.mp3`; no abbreviations; consistent with WP-413.
- **§7 Dependency discipline** — PASS. **No new dependency** — reuses WP-412's engine.
- **§8 Architectural boundaries** — PASS. App layer only; reads the typed `UIState` (`.` subpath), no runtime engine/registry import, no `G` write. The ewiki docs are non-runtime.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced (the clip URL is a static R2 path).
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test`; engine injected / `Howl` mocked (asset-independent); `typecheck` gated; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the client `typecheck` gate (the exhaustiveness pin) is explicit.
- **§14 Acceptance criteria** — PASS. 9 binary, observable items aligned to the deliverables (tier boundaries, the union, manifest exhaustiveness, the consumer, the untouched files, the doc reflection, the gates, scope).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` ⇒ §15.1 live-on-surface (D-24026) present with the asset prerequisite noted honestly.
- **§16 Code style** — PASS. A pure tier helper extension (an explicit `if` ladder, no ternary/reduce) + a manifest entry + test cases; `// why:` on the R2/hyphen rule and the narrowed `big` edge; no abbreviations; every function keeps its JSDoc.
- **§17 Vision Alignment** — N/A (declared) + monetization + determinism notes: audio is retention polish, never pay-to-win; pure client presentation, zero determinism footprint; NG-1..7 preserved.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `comboCueManifest.ts` for `legendary`/`combo-legendary` (source-file scoped, not a forbidden-token grep over prose).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy is added or proposed (client audio tier + design docs only).
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; consumes the `UIState` push and a static R2 clip.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-25).**

- **Sequencing / dependencies:** WP-413 / D-24228 (the exact `comboCueManifest`
  surface + `useComboCue` + the EC-448 lazy-load), WP-409 / D-24221 (the
  unbounded scalar), and WP-412 / D-24224 (the engine + `01.5` host) are all on
  `main`. No engine dependency; a pure client extension.
- **Green baseline:** `main @ 0c129ae6`.
- **Scope lock:** closed allowlist (3 arena-client files + 2 ewiki docs), no
  `01.5` wiring file (the host already mounts the consumer); `git diff --name-only`
  is a DoD gate that explicitly excludes `useComboCue.ts`, `audioEngine.ts`, and
  `packages/game-engine/**`.
- **Contract fidelity:** the change is the minimal extension of D-24228 — one
  new union member, one new `comboTierForCount` branch (the `big` edge narrows to
  `4`), one new manifest entry; the `Record<Exclude<…>, string>` type +
  `AUDIBLE_TIERS` test is the union↔map drift pin; D-24246 locks the boundary for
  both layers.
- **RS-1 (clarification, non-blocking):** the **visual** `LEGENDARY!` call-out is
  NOT built here — the VFX layer does not exist in code; D-24246 locks the shared
  tier so the future visual consumer inherits it, and the ewiki docs frame the
  visual as that future consumer. Named in Goal / User-Visible Impact / Out of
  Scope.
- **RS-2 (clarification, non-blocking):** the ewiki contract-doc reflection
  (`wiki/*.md`) is in scope by the "may not diverge" rule so the documented
  contract can never lag the code; it is a separate deploy surface (the ewiki),
  not a runtime layer crossing.
- **Empirical scaffold (drafting session, reverted):** the change was
  prototyped on this branch — `'legendary'` added to the union, the `>= 5`
  branch to `comboTierForCount`, the manifest entry, and the three test edits —
  and the arena-client suite run: **`vue-tsc` typecheck 0** (the
  `Record<Exclude<ComboTier, 'none'>, string>` pin held) and **1094 / 1094 tests
  pass, 0 fail** (from 1093 on the baseline: +2 boundary cases, -1 merged `big`
  test). The ONLY existing fixture that broke was the count-`5` case in
  `useComboCue.test.ts` (already in `§Scope (In) C`) — no other file needed
  touching, empirically confirming the closed allowlist. The prototype was then
  reverted (this SPEC draft is docs-only; the code lands at execution).
- **PS items (blocking):** none. (Live D-24026 verification depends on
  `combo-legendary.mp3` being uploaded to R2 — an operator prerequisite, not a
  code blocker, exactly as for WP-413's three clips.)

---

## Copilot Check (01.7)

> Recorded at drafting; the executing session may re-run.

**Overall judgment: PASS → CONFIRM (2026-07-25).** Additive, single runtime
layer (App), tightly precedented (extends the shipped WP-413 surface by one
tier), no engine/determinism risk, no new dependency, the tier-agnostic consumer
untouched.

Selected findings:
- **#1 / #9 (layer boundary)** — PASS. Client-only runtime; reads typed
  `UIState`, no runtime engine/registry import, no `G` write. The ewiki docs are
  non-runtime design reference.
- **#2 (determinism)** — PASS. Zero engine footprint; audio is invisible to
  replays/sims; no `finalStateHash` sentinel touched (the AC pins an App-only
  runtime diff + untouched engine suites).
- **#4 (contract drift)** — PASS. Extends D-24228's mapping under a new locked
  D-24246; the union↔map `vue-tsc` pin + `AUDIBLE_TIERS` test prevent a silent
  half-change; the ewiki contract doc is updated in lockstep (no code-vs-doc
  divergence).
- **#7 (new dependency)** — PASS. **No** new dependency — reuses the WP-412
  engine; `audioEngine.ts` and `useComboCue.ts` untouched.
- **#12 (scope creep)** — PASS. One apex tier only; the visual renderer, a fifth
  tier, and any re-tiering of `1/2/3–4` explicitly deferred; closed allowlist +
  `git diff` gate.

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24246 (reserved; Drafted 2026-07-25, not yet landed)** — The Combo Tier
  Contract gains a **fourth tier**: `comboTierForCount(count)` maps
  `count >= 5 → 'legendary'` (and narrows `big` to `3–4`), above the WP-413 /
  D-24228 mapping (`<= 0 → none`, `1 → small`, `2 → medium`, `>= 3 → big`).
  (1) **Shared, not renderer-specific.** The boundary is locked for **both**
  consumers of `comboTierForCount` — the audio combo sting (shipped by this WP)
  and the future visual combo-flash / synergy call-out (`LEGENDARY!`, not yet
  built). Per the Combo Tier Contract "may not diverge" rule, a tier boundary is
  never added to one renderer alone; adding it here adds it for both at once, so
  when the VFX layer ships it inherits the same `>= 5` boundary. This resolves the
  ewiki "Combo scaling beyond T3" open question — the apex `LEGENDARY!` rung is
  where that decision cashes out. (2) **Audio now, visual later.** This WP ships
  the audible tier only (a CC0 `combo-legendary.mp3` on R2, referenced by URL, no
  audio in git); the visual call-out is a separate WP that consumes this same
  locked tier. (3) **Architecture unchanged.** Pure client presentation — it lives
  in `apps/arena-client`, reads only `UIState.game.lastPlayEffectsFired` (WP-409),
  never writes `G`/`ctx`, and adds zero engine / determinism / replay footprint.
  (4) **Minimal extension.** One new `ComboTier` union member (`'legendary'`), one
  new `comboTierForCount` branch, one new `comboCueManifest` entry; the
  `Record<Exclude<ComboTier, 'none'>, string>` type + the `AUDIBLE_TIERS` drift
  test enforce the union↔map lockstep. `useComboCue` (tier-agnostic) and
  `audioEngine` (lazy-load-any-URL, EC-448) are unchanged. The ewiki Combo Tier
  Contract + narrative call-out ladder are updated in the same session so the
  documented contract matches the code. A fifth tier would be a further
  `DECISIONS.md` change adding it for both layers at once.

---

## See Also

- [WP-413](WP-413-arena-client-tiered-combo-cue.md) / D-24228 — the shipped
  3-tier combo cue this extends (`comboTierForCount`, `comboCueManifest`,
  `useComboCue`, the EC-448 lazy-load).
- [WP-409](WP-409-hero-play-synergy-effect-count-signal.md) / D-24221 — the
  `UIState.game.lastPlayEffectsFired` scalar the tier scales on.
- [WP-412](WP-412-arena-client-audio-layer-foundation.md) / D-24224 — the audio
  foundation (engine, unlock, mute/volume, `01.5` host) the sting reuses.
- ewiki [Visual Effects → Combo Tier Contract](https://ewiki.legendary-arena.com/visual-effects/) and [Narrative Psychology → Synergy call-outs](https://ewiki.legendary-arena.com/narrative-psychology/) — the contract + the `LEGENDARY!` ladder this locks.
