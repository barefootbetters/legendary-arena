# EC-460 — Apex `LEGENDARY!` Combo Tier (Execution Checklist)

**Source:** docs/ai/work-packets/WP-425-apex-legendary-combo-tier.md
**Layer:** App (`apps/arena-client`) + ewiki contract docs

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] WP-413 / D-24228 is on `main`: `apps/arena-client/src/audio/comboCueManifest.ts` exports `ComboTier = 'none'|'small'|'medium'|'big'`, the pure `comboTierForCount` (`<=0 none`, `1 small`, `2 medium`, `>=3 big`), and `comboCueManifest: Record<Exclude<ComboTier,'none'>,string>` (three `combo-*.mp3` URLs). `useComboCue.ts` plays `comboCueManifest[tier]` for any audible tier (tier-agnostic). `audioEngine.play()` lazy-loads any un-preloaded URL (EC-448 amendment).
- [ ] `UIState.game.lastPlayEffectsFired: number` (WP-409 / D-24221) is live — public scalar, reset to `0` in the play-phase `onBegin`, unbounded above.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL — surface as a blocker, do not improvise. In particular: do NOT edit `useComboCue.ts` or `audioEngine.ts`, and NO `packages/game-engine/**` file.

## Locked Values (do not re-derive)
- Tier type: `ComboTier = 'none' | 'small' | 'medium' | 'big' | 'legendary'`.
- Tier thresholds: `comboTierForCount(count)` → `<= 0` none, `1` small, `2` medium, `3–4` big, `>= 5` legendary. The `big` branch narrows from open-ended to `if (count <= 4) return 'big'; return 'legendary';`.
- New manifest key: `legendary` → `${COMBO_BASE_URL}combo-legendary.mp3` (hyphenated filename, `audio/sound-effects/` prefix on `images.legendary-arena.com`). The other three URLs are unchanged.
- No new dependency / engine / control / channel. `useComboCue.ts` and `audioEngine.ts` are UNCHANGED. No new `01.5` wiring host (`PlayViewport.vue` already mounts the consumer).
- Signal source: `UIState.game.lastPlayEffectsFired` (public scalar; unbounded above; safe on a null snapshot).
- Contract-doc reflection is REQUIRED (may-not-diverge): the ewiki Combo Tier Contract + narrative ladder show the fourth `>= 5 → legendary`/`LEGENDARY!` tier as **locked**, citing D-24246.
- Reserved decision: **D-24246** (land Active at close).

## Guardrails
- Pure presentation: reads `UIState` only — NEVER writes `G`/`ctx`, never affects an outcome, zero engine/determinism/replay footprint. A `packages/game-engine/**` file in the diff ⇒ STOP (out of scope).
- Extend, do not rebuild: add `'legendary'` to the EXISTING `comboCueManifest.ts`; no new module/engine/`Howl`/control/channel. `useComboCue.ts` (tier-agnostic) and `audioEngine.ts` (lazy-load) do NOT change.
- Update the union AND the manifest together: the `Record<Exclude<ComboTier,'none'>,string>` type fails `vue-tsc` if `'legendary'` is added to the union but not mapped (and vice-versa). The `AUDIBLE_TIERS` test is the paired drift pin.
- Shared tier, not audio-only (D-24246): the `>= 5` boundary is the fourth Combo Tier Contract tier for BOTH the audio sting (now) and the future visual call-out; the ewiki contract docs update in the same session.
- Audio bytes hosted on R2, NEVER committed to git; the manifest carries the `combo-legendary.mp3` URL only. Tests inject a mock/recording engine (no real audio, asset-independent).
- The visual `LEGENDARY!` renderer is NOT built here (the VFX layer is design-only); this WP is audio + contract-doc only.

## Required `// why:` Comments
- `comboCueManifest.ts` (narrowed `big` edge): `big` now covers `3–4` only — `>= 5` is the apex `legendary` tier (D-24246, the 4th shared Combo Tier Contract boundary); the pre-existing R2/hyphen `// why:` note extends to `combo-legendary.mp3`.

## Files to Produce
- `apps/arena-client/src/audio/comboCueManifest.ts` — **modified** — `'legendary'` in `ComboTier`; `comboTierForCount` `>= 5 → legendary` (big narrows to `3–4`); `legendary → combo-legendary.mp3` in `comboCueManifest`; JSDoc header "four tiers"
- `apps/arena-client/src/audio/comboCueManifest.test.ts` — **modified** — boundaries `3 → big`, `4 → big`, `5 → legendary`, `12 → legendary`; `'legendary'` added to `AUDIBLE_TIERS`; `legendary` maps to a non-empty `audio/sound-effects/` URL
- `apps/arena-client/src/composables/useComboCue.test.ts` — **modified** — the count-`5` integration case now expects `comboCueManifest.legendary`; add a case that an audible value-change to `>= 5` plays the apex clip
- `wiki/visual-effects.md` — **modified** — fourth row in the Combo Tier Contract + Surface-2 tables; `LEGENDARY!` rung locked; resolve "Combo scaling beyond T3" (cite D-24246); visual call-out still framed as the future consumer
- `wiki/narrative-psychology.md` — **modified** — synergy call-out ladder: `LEGENDARY!` apex marked locked (`>= 5`, cite D-24246)

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — the load-bearing SFC + exhaustiveness-pin gate).
- [ ] `pnpm --filter arena-client test` passes (engine injected / `Howl` mocked).
- [ ] `git diff --name-only` = the five allowlist files (+ governance); NO `useComboCue.ts`, NO `audioEngine.ts`, NO `packages/game-engine/**`.
- [ ] Live-on-surface (D-24026): a deployed 5+-effect play sounds `combo-legendary.mp3` (distinct from `big`); mute silences it. Requires `combo-legendary.mp3` on R2 (operator upload). Direct scalar drive on the fixture route (clip 200 in tier order) satisfies the audio-side check if a natural 5+ chain is impractical.
- [ ] `docs/ai/STATUS.md` — the apex `legendary` combo tier riding the WP-412 engine + WP-409 signal.
- [ ] `docs/ai/DECISIONS.md` — land D-24246 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-425 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-460 Draft → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-425 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- `useComboCue.ts` or `audioEngine.ts` in the diff ⇒ you rebuilt/rewired instead of just extending the tier model (the consumer is tier-agnostic; the engine already lazy-loads any URL).
- A `packages/game-engine/**` file in the diff ⇒ you drifted into the engine; this is App + docs only.
- `vue-tsc` red on `comboCueManifest` ⇒ you added `'legendary'` to the union but not the manifest (or vice-versa) — the exhaustiveness pin caught the half-change.
- `big` still returns for `count === 5` ⇒ the `big` branch did not narrow to `<= 4`.
- The ewiki still shows three tiers / `LEGENDARY!` as "reserved" ⇒ the contract doc lags the code (may-not-diverge violation).
- A committed `.mp3` ⇒ audio bytes live on R2, not git.
