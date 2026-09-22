# Session Prompt — WP-735 / EC-772: Venompool "Digest N / Indigestion" Victory-Pile branch

**WP:** docs/ai/work-packets/WP-735-venompool-digest-indigestion.md
**EC:** docs/ai/execution-checklists/EC-772-venompool-digest-indigestion.checklist.md (authoritative execution contract)
**Reserves:** D-24555 (lands Active at govern-close). **Status:** READY TO EXECUTE (pre-flight READY + copilot PASS).

> Committed via `git add -f` (session-*.md is gitignored) so the brief survives the drafting
> worktree's removal — per `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Un-hollow the D-21602-deferred Venompool **"Digest N / Indigestion"** family. Add a new
`digest-indigestion` hero keyword whose onPlay handler reads the player's Victory-Pile card
**count** and runs the printed branch — Digest (count ≥ N) OR Indigestion (count < N), mutually
exclusive per the Venomverse rulebook — plus a `[hc/team]: Instead, you get both` upgrade that
runs both regardless of count. Resolve **only** the four allowlisted vnom cards; keep every
other Digest/Indigestion card and the entire Excessive Violence family as honest hollows.
Engine + card-data only — no client, no pending choice, no new G field.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; UIState projection; persistence boundary)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-735 (design authority)
5. EC-772 (execution contract — satisfy every item exactly)
6. `scripts/convert-cards/inputs/keywords-full.json` glossary ids **54 (Digest)** + **55 (Indigestion)** — the exact semantics; model verbatim, do NOT reinterpret
7. Source anchors (from the WP §Context, verified by pre-flight):
   `setup/heroAbility.setup.ts` (`buildHeroAbilityHooks` ~2838, allowlist threading ~2908-2924, `coalesceCountScaledChooseOne` ~2250/2897, `KEYWORD_PATTERN` ~124, count-scaled dedicated patterns ~192/225, Step 1a/1b conditions ~780-864);
   `rules/heroAbility.types.ts` (`HeroEffectDescriptor` ~108-178, `HeroCondition` ~94-97);
   `hero/heroEffects.execute.ts` (`executeHeroEffects` ~655, `executeSingleEffect` ~4878, `heroEffectRescue` ~1425, reentrant copy-powers/steal-abilities ~4020/4200, `HANDLED_KEYWORDS` ~108, `NO_MAGNITUDE_KEYWORDS` ~377, `HERO_EFFECT_HANDLERS` ~4727);
   `hero/heroConditions.evaluate.ts` (`evaluateCondition` ~40, `bystandersInVictoryAtLeast` ~253);
   `state/zones.types.ts:51` (`victory` zone)
8. User memory: `reference_hero_ability_marker_curated_map`, `reference_sim_coverage_baseline_gate_distinct`, `reference_hashed_g_field_dual_repin`

## Pre-execution checks

- Baseline `origin/main` clean + synced; the WP-735/EC-772/D-24555 reserve is already on main.
- `pnpm --filter @legendary-arena/game-engine build && … test` green; **record the baseline test count** and the current `HERO_KEYWORDS.length` (expected 62) and `HERO_EFFECT_HANDLERS` size (expected 46) — concurrent WPs may have moved them; READ them, do not trust the numbers in the EC.
- Confirm `[keyword:Digest 2]` (space form) is NOT matched by `KEYWORD_PATTERN` and `[keyword:Indigestion]` falls through as an unresolved marker today (the hollow being fixed).

## Execution rules (operationalizing WP-735 + EC-772 — no new scope)

- **New keyword `digest-indigestion`** in the `HeroKeyword` union AND `HERO_KEYWORDS` (62→63), handler in `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS` (46→47), AND in `NO_MAGNITUDE_KEYWORDS` (the wrapper carries no top-level magnitude; branch magnitudes ride the inline markers).
- **Compound descriptor** — add `digestThreshold?: number`, `digestEffects?: HeroEffectDescriptor[]`, `indigestionEffects?: HeroEffectDescriptor[]`, `bothCondition?: HeroCondition` to `HeroEffectDescriptor` (the `revealRules?`/`countScaledChoiceOptions?` additive-optional-field precedent; land D-24555 Active for the contract-file edit).
- **Setup-time fusion** — a `DIGEST_PATTERN` (`/\[keyword:Digest (\d+)\]/`, space form) reads the threshold; a `DIGEST_INDIGESTION_CARDS` allowlist (the four canonical keys) gates resolution; the fusion MUST receive the canonical `{setAbbr}/{heroSlug}/{cardSlug}` key (thread it like `SUPPORTED_TRANSFORM_BASES`, or run inside `buildHeroAbilityHooks` where the key is computed — NOT the bare-`abilities` coalescer signature) and must be **non-mutating** (return a new array; leave display `abilities[]` untouched). It parses the Digest line's inline effects → `digestEffects`, the Indigestion line's → `indigestionEffects`, the upgrade line's `[hc:X]`/`[team:X][team:X]` → `bothCondition`, emits ONE `digest-indigestion` hook, and **consumes** the source tokens (no leftover unresolved `Indigestion` marker, no duplicate attack/rescue/draw hook, no inert conditional hook).
- **Handler `heroEffectDigestIndigestion`** — safe-skip first (if `digestThreshold`/`digestEffects` is `undefined`, no-op — never `count >= undefined`); else `count = G.playerZones[playerID].victory.length`; if `bothCondition` present and `evaluateCondition` true → run `digestEffects` then `indigestionEffects` (printed order); elif `count >= digestThreshold` → `digestEffects`; else → `indigestionEffects ?? []`. Dispatch each branch effect via `executeSingleEffect` (reentrant). **READ-ONLY on the Victory Pile** — never remove/reorder. `for...of`, no `.reduce()`. Never throws.
- **Faithfulness** — Digest = read-only VP-count threshold (glossary id 54); Indigestion = mutually-exclusive fallback used ONLY below threshold (id 55); the printed `Instead, you get both.` OVERRIDES the gate → both branches run regardless of count. The branch-select `// why:` cites the verbatim printed upgrade line.
- **Card-data** — append via the curated map `inputs/hero-ability-markers.json` (both tokens already legal, no apply-script change): `[keyword:draw:2]` to `carnage/carnivore` idx0, `[keyword:draw:1]` to `venomized-dr-strange/cauldron-of-the-cosmos` idx0, `[keyword:rescue:1]` to `venompool/digest-that-chimichanga` idx1 — **3 net-new rows**; update/remove the single existing `_deferred` row (`digest-that-chimichanga` idx1). The other three were never `_deferred`. Regenerate `data/cards/vnom.json` (vnom is non-co2e → normal regen) + the four derived feeds; run `sim:coverage --check`, regen the baseline ONLY if it flags the new keyword.
- **Determinism** — no new G field; ctx-free count read + branch. All four cards are vnom (non-core); no committed sentinel/PRE_WP080 fixture plays them → `finalStateHash`/`PRE_WP080_HASH` expected byte-unchanged. VERIFY empirically; if a pin shifts, dual re-pin HONESTLY (`reference_hashed_g_field_dual_repin`) — never edit a pin to force green.
- **Tests** — the drift bumps (three numeric `HERO_KEYWORDS.length` sites + the expected-array parity `deepStrictEqual`; do NOT hardcode the dynamic `uniqueKeywords.size === HERO_KEYWORDS.length`; both handler-count sites; bidirectional `HANDLED_KEYWORDS` set) + branch tests (threshold-met, threshold-unmet, both below threshold, single-branch no-op, Victory-Pile byte-unchanged, missing-`digestThreshold` safe-skip, fused-hook `JSON.parse(JSON.stringify())` roundtrip, non-allowlisted card stays hollow, fusion consumes tokens). Update stale it()-title/message text alongside each count bump.
- **No client / pending choice / UIState / new move** — every Core-4 branch auto-resolves synchronously.

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-735 per EC-772: keyword + compound descriptor + allowlist-gated non-mutating fusion
+ handler + card-data markers + regen + full test set. Two-commit topology: `EC-772:`
implementation, then `SPEC:` govern-close (land D-24555 Active; flip WORK_INDEX `[x]`, EC_INDEX
Done, mindmap ✅, `roadmap:counts:write`, `ledger:numbers:check`; update STATUS.md). Open one PR.
**D-24026 live-verify REQUIRED** (post-deploy, surface = `play.legendary-arena.com`): a live match
where Digest That Chimichanga rescues below 2 Victory-Pile cards, grants +2 Attack at 2+, and does
both on a Strength deck — verified against the deployed `/api/version` gitSha; recorded as a
follow-up STATUS-flip, not a merge blocker.

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- `node scripts/prune-empty-claude-branch.mjs --verify-current` from the worktree (expect `VERIFY PASS`).
- `git branch -D <branch>` + `git push origin --delete <branch>`.
- `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates/operationalizes WP-735 + EC-772 only. No new scope, files, contract
elements, locked values, or forbidden patterns. New surface goes back into the WP/EC and
re-runs the gates.
