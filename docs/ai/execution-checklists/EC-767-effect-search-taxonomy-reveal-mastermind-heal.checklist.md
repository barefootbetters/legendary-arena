# EC-767 — Effect-search taxonomy: Reveal + Gain a Hero + KO a Wound (Execution Checklist)

**Source:** docs/ai/work-packets/WP-730-effect-search-taxonomy-reveal-mastermind-heal.md
**Layer:** Registry Viewer (data-only — `data/metadata/card-abilities.json`)

## Before Starting
- [ ] WP-125 ✅ on `main`: `data/metadata/card-abilities.json` (11 entries), `CardAbilityEntrySchema` (`packages/registry/src/schema.ts`), `cardAbilitiesClient.ts` all present
- [ ] Target file set = `Files to Produce` below; any code/schema/UI file is OUT of scope — a FAIL, surface as a blocker
- [ ] Read `reference_effect_search_taxonomy_r2` (user memory) — the R2 upload + the matcher-authoring FP/FR lesson
- [ ] Corpus scaffold ready: a throwaway scan over `data/cards/*.json` `<entityType>[].cards[].abilities[]` (2,970 cards with abilities on `main`)
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 (baseline)

## Locked Values (do not re-derive — verbatim JSON entries)
```json
{ "slug": "reveal-top-of-deck", "label": "Reveal (top of deck)", "emoji": "👁️", "order": 12,
  "matchers": [ { "type": "regex", "pattern": "\\breveal the top (card|(\\d+|two|three|four|five) cards) of your deck", "flags": "i" } ] }
{ "slug": "ko-a-wound", "label": "KO a Wound (heal)", "emoji": "🩹", "order": 45,
  "matchers": [ { "type": "regex", "pattern": "\\bKO (a|one|two|\\d+) Wounds?\\b", "flags": "i" } ] }
{ "slug": "gain-a-hero", "label": "Gain a Hero", "emoji": "🦸", "order": 95,
  "matchers": [ { "type": "regex", "pattern": "\\bgain (a|an|the|that|any|each|one|two|\\d+) [^.]{0,26}?Heroe?s?\\b", "flags": "i" } ] }
```
- Expected corpus counts: **reveal-top-of-deck 119**, **ko-a-wound 22**, **gain-a-hero 46** (±a couple if `main` card-data shifted).
- **Swap note (2026-09-21):** the third effect was changed from `defeat-mastermind` (5 cards) to `gain-a-hero` (46) at operator request; the reserved filename/slug still reads `…reveal-mastermind-heal`.

## Guardrails
- **Data-only, additive.** ONLY `data/metadata/card-abilities.json` changes — append the 3 entries; the 11 existing entries stay byte-unchanged. NO registry code, schema, `cardAbilitiesClient.ts`, UI, or engine change.
- **Corpus-validate every matcher BEFORE ship** (the #2078 "Discard a card" lesson): confirm the count AND spot-check for false positives + false removals. A mis-scoped matcher is a FAIL, not a ship.
- **Reveal is the player self-deck scry only** — `… of your deck` (119), NOT the broad `reveal the top` (247, which hits the Villain/Hero/Bystander decks).
- **`ko-a-wound` is distinct**: matches the prose "KO a Wound …", NOT the `[keyword:ko-wound-reward:…]` marker and NOT `ko-from-hand` ("card", not "Wound").
- **`gain-a-hero` matches Hero-as-object-gained** (`gain <article/adj> … Hero` from HQ / KO pile / revealed / captured / `[hc:]`/`[team:]`-qualified); NOT a counting noun — "gain a Wound/Bystander … for each Hero" must NOT match (zero such false positives in the corpus at draft).
- **`CardAbilityEntrySchema` unchanged** — entries validate under the existing `.strict()` schema; no new matcher `type`, no new field; no duplicate slug/order.
- **R2 upload is part of done** — the live site reads R2, not the bundle. Export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from `.env` first (else rclone hangs on IMDS); no `--progress`.
- **Clobber gotcha:** confirm the working-tree `card-abilities.json` is the intended live bytes BEFORE any `rclone copy data/metadata/` (a prior `git checkout --` revert would upload stale content).

## Required `// why:` Comments
- N/A — JSON data file (no comments). The matcher scoping rationale lives in this EC + WP-730 §Locked-values.

## Files to Produce
- `data/metadata/card-abilities.json` — **modified** — append the 3 locked entries (11 → 14)
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-730 `📝` → `✅`
- (R2 object `r2:legendary-images/metadata/card-abilities.json` — **uploaded**, not a repo file)
- (No `DECISIONS.md` — no new D)

## After Completing
- [ ] `node -e` structure check: 14 entries, unique slugs + orders, all schema-valid
- [ ] Corpus validation: 119 / 22 / 46, each FP + FR spot-checked
- [ ] `pnpm --filter @legendary-arena/registry build` + `pnpm --filter registry-viewer build` exit 0
- [ ] `git diff --name-only` = `data/metadata/card-abilities.json` + governance docs only (no `packages/**` code, no `apps/**`)
- [ ] R2 upload done (`Cache-Control: no-cache`); working-tree file confirmed correct pre-upload
- [ ] `docs/ai/STATUS.md` names WP-730 + the 3 effects; D-24026 live-verify operator-pending
- [ ] WORK_INDEX + EC_INDEX flipped to Done; `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0
- [ ] **Live-on-surface (D-24026):** on `cards.legendary-arena.com`, the 3 chips appear in the Effects dropdown and filter to ~119 / 22 / 46 (operator-pending post-upload)

## Common Failure Smells
- A Reveal count near 247 means the matcher lost the `of your deck` anchor and is catching Villain/Hero-deck reveals — re-scope.
- A `ko-a-wound` count much higher than 22 means it is matching the `ko-wound-reward` marker or `ko-from-hand` — re-scope.
- The Effects dropdown still showing 11 (not 14) after "deploy" means the JSON was committed but never uploaded to R2 (the live site reads R2, not the bundle).
