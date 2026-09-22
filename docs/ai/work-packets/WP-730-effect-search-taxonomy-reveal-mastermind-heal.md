# WP-730 — Effect-search taxonomy: Reveal + Gain a Hero + KO a Wound (heal)

> **Note (2026-09-21 SPEC swap):** the reserved filename/slug still reads
> `…reveal-mastermind-heal` (a reservation identifier). The third effect was
> swapped from **Defeat a Mastermind** (5 cards, too thin) to **Gain a Hero**
> (46 cards) at operator request before execution; content below is authoritative.

**Status:** Draft 2026-09-21 · **EC:** EC-767 · **Reserves:** (none)
**Primary Layer:** Registry Viewer (data-only — `data/metadata/card-abilities.json`)
**User-Visible Surface:** `cards.legendary-arena.com` (the **Effects** filter dropdown)
**Lane:** Lightweight-lane eligible (single data file, strictly additive) — see §Context.

## Goal

Add three new effects to the hand-authored **Effects** filter taxonomy on
`cards.legendary-arena.com` (`data/metadata/card-abilities.json`), taking it from
11 to 14 entries: **Reveal (top of deck)**, **Gain a Hero**, and **KO a
Wound (heal)**. Each is a `{ slug, label, emoji, order, matchers }` entry whose
regex matcher runs against every card's `abilities[]` text; the dropdown gains
three new filter chips. The matchers are **corpus-validated** (against the 2,970
cards with ability text) for both false positives and false removals before ship,
per the PR #2078 "Discard a card" lesson. Data-only + an R2 upload — no registry
code, schema, or engine change.

## User-Visible Impact

A visitor to `cards.legendary-arena.com` opening the **Effects** filter sees three
new options and can filter the card grid by them: **Reveal (top of deck)** (≈119
cards — the player self-deck scry), **Gain a Hero** (≈46 cards — gain/recruit a Hero
to a zone from the HQ, KO pile, revealed, or captured), **KO a Wound (heal)** (22
cards). D-24026 live-verification applies (the effects appear in the
dropdown and filter to the expected counts on the deployed site).

## Assumes

- **WP-125 / EC-127 ✅** — the Effects filter exists: `data/metadata/card-abilities.json`
  (R2-served), `cardAbilitiesClient.ts` (fetches `{metadataBaseUrl}/metadata/card-abilities.json`),
  the dropdown UI, and `CardAbilityEntrySchema` (`packages/registry/src/schema.ts`)
  validating each entry `{ slug (kebab), label, emoji?, order, matchers:[{type:"regex",pattern,flags?}] }`.
  This WP adds entries only — no schema, client, or UI change.
- The live site **fetches this file from R2 at runtime** (`cf-cache-status: DYNAMIC`,
  `Cache-Control: no-cache`), so shipping = edit the JSON **and upload to R2** — no
  CF Pages redeploy. Upload per `reference_effect_search_taxonomy_r2` in user memory
  (`rclone copy … r2:legendary-images/metadata/`; the `r2:` remote needs the
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pair from repo `.env` exported first,
  no `--progress`).
- `data/cards/*.json` on `main` is the ability-text corpus the matchers run against
  (`<entityType>[].cards[].abilities[]`). 2,970 cards carry ability text as of `main`.

## Context (Read First)

- `data/metadata/card-abilities.json` — the 11 existing entries + their conventions
  (order steps of 10; `flags:"i"`; JSON-escaped patterns `\\b`, `\\d`, `\\[`). The new
  entries slot at unused order values without renumbering.
- `docs/ai/work-packets/WP-125-registry-viewer-card-abilities-effect-filter.md` — the
  filter's design + the matcher/authoring conventions.
- `packages/registry/src/schema.ts` — `CardAbilityEntrySchema` (`.strict()` rejects
  unknown fields). New entries must satisfy it verbatim; **no schema change**.
- User memory `reference_effect_search_taxonomy_r2` — the R2 upload procedure + the
  **matcher-authoring lesson**: exclude zone nouns and validate a new matcher against
  the corpus for false positives AND false removals (the broad `\bdiscards?\b`
  false-matched the "discard pile" zone; #2078 tightened it).
- **Lightweight-lane note:** this is a single-file, strictly-additive data change with
  no contract file, no determinism surface, and no cross-layer crossing — it qualifies
  for the Lightweight Lane (`01.0a §Lightweight Lane`). The operator may execute it in
  one session (draft → corpus-scaffold → edit → govern-close → one PR + the R2 upload)
  rather than the two-session split. The mandatory scaffold is the corpus-validation
  run (§Verification Step 2).

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+; human-style code per
`docs/ai/REFERENCE/00.6-code-style.md`; full file contents, no diffs.

**Packet-specific:**
- **Data-only.** The ONLY code/data change is adding three entries to
  `data/metadata/card-abilities.json`. No `packages/registry/**` code, no schema, no
  `cardAbilitiesClient.ts`, no UI, no engine change.
- **Additive only.** The 11 existing entries are byte-unchanged; the three new entries
  are appended (JSON array order does not matter — the dropdown sorts by `order`).
- **Matchers are corpus-validated before ship.** Each new matcher MUST be run against
  the `data/cards/*.json` ability-text corpus and confirmed for the locked card count
  AND spot-checked for false positives (a match that is not really that effect) and
  false removals (a real instance the pattern misses). A matcher that mis-scopes is a
  FAIL, not a ship.
- **`CardAbilityEntrySchema` unchanged.** Each entry validates under the existing
  `.strict()` schema (no new matcher `type`, no new field).
- **R2 upload is part of "done."** The file must be uploaded to
  `r2:legendary-images/metadata/card-abilities.json` (the live site reads R2, not the
  bundle). Confirm the AWS_* env is exported first (else rclone hangs on IMDS).

**Session protocol:** if a locked matcher's corpus count diverges from this WP's
number by more than a couple of cards, STOP and reconcile (a card-data change on `main`
may have shifted it) — do not silently ship a different scope.

**Locked contract values (verbatim — do not re-derive):**

| slug | label | emoji | order | matcher pattern (JSON-escaped) | flags | ~cards |
|---|---|---|---|---|---|---|
| `reveal-top-of-deck` | `Reveal (top of deck)` | 👁️ | 12 | `\\breveal the top (card\|(\\d+\|two\|three\|four\|five) cards) of your deck` | `i` | 119 |
| `ko-a-wound` | `KO a Wound (heal)` | 🩹 | 45 | `\\bKO (a\|one\|two\|\\d+) Wounds?\\b` | `i` | 22 |
| `gain-a-hero` | `Gain a Hero` | 🦸 | 95 | `\\bgain (a\|an\|the\|that\|any\|each\|one\|two\|\\d+) [^.]{0,26}?Heroe?s?\\b` | `i` | 46 |

## Scope (In)

- Modify `data/metadata/card-abilities.json` — append the three entries above,
  verbatim per the Locked-values table (slug / label / emoji / order / matchers /
  flags). Keep the existing 11 entries byte-unchanged.
- Upload the edited file to R2 (`r2:legendary-images/metadata/card-abilities.json`)
  with `Cache-Control: no-cache` preserved (per `reference_effect_search_taxonomy_r2`).

## Out of Scope

- **Any registry code / schema / client / UI change** — `CardAbilityEntrySchema`,
  `cardAbilitiesClient.ts`, the dropdown component are all untouched (additive data only).
- **A generator or CI drift/validation gate for `card-abilities.json`** — the taxonomy
  stays hand-authored; a validation-tooling WP is a separate, deferred item (the "tooling"
  option not chosen for this WP).
- **The broad `reveal the top` (247) scope** — this WP scopes Reveal to the player's
  **own** deck (`… of your deck`, 119); the Villain/Hero/Bystander/Ally-deck reveals are
  deliberately excluded (they are not a player self-deck effect).
- **Any `data/cards/*.json` edit** — the corpus is read-only input to matcher validation.
- **Other candidate effects** (Put on top of deck, cost reduction, Defeat a Mastermind,
  Each other player, etc.) — deferred to a future taxonomy WP. (Defeat a Mastermind was
  dropped from this batch — only 5 cards; swapped for Gain a Hero.)

## Files Expected to Change

- `data/metadata/card-abilities.json` — **modified** — append 3 entries (11 → 14).
- `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-730 node `📝` → `✅`; then `pnpm roadmap:counts:write`.

(No `DECISIONS.md` entry — no architectural decision is locked; the matchers are the
contract, held in this WP + EC. Consistent with the INFRA-precedent effect adds
PR #2077 / #2078.)

## Contract

- The Effects dropdown gains exactly three chips: **Reveal (top of deck)**, **KO a
  Wound (heal)**, **Gain a Hero**, sorted by `order` (12 / 45 / 95) among the
  existing entries.
- Filter semantics inherit WP-125 verbatim: OR within selected effects, AND with every
  other filter; matcher `flags` default `"i"`; matchers run against each card's
  `abilities[]` text.
- Each matcher is scoped as locked above; Reveal is the **player self-deck** scry only.

## Acceptance Criteria

1. `data/metadata/card-abilities.json` has exactly 14 entries; the 11 pre-existing
   entries are byte-unchanged.
2. The three new entries match the Locked-values table verbatim (slug, label, emoji,
   order 12/45/95, matcher pattern, `flags:"i"`).
3. The file parses and every entry validates under `CardAbilityEntrySchema` (no
   `.strict()` violation, no duplicate slug, no duplicate order).
4. **Corpus validation:** `reveal-top-of-deck` matches **119** cards, `ko-a-wound`
   matches **22**, `gain-a-hero` matches **46** (±a couple if `main` card-data shifted);
   each spot-checked — Reveal matches only "… of your deck" (not Villain/Hero/Bystander
   deck reveals), `ko-a-wound` matches the prose "KO a Wound …" (not the
   `[keyword:ko-wound-reward:…]` marker) and not `ko-from-hand` ("card"), `gain-a-hero`
   matches "gain a/the/that … Hero" where **Hero is the object gained** (HQ / KO pile /
   revealed / captured / `[hc:]`/`[team:]`-qualified) and NOT "gain a Wound/Bystander …
   for each Hero" (zero such false positives in the corpus at draft).
5. The updated file is uploaded to `r2:legendary-images/metadata/card-abilities.json`
   with `Cache-Control: no-cache`.
6. On the deployed `cards.legendary-arena.com`, the three chips appear in the Effects
   dropdown and filter the grid to the expected counts (D-24026, post-upload).

## Verification Steps

```bash
# 1. Structure: 14 entries, schema-valid, unique slugs/orders
node -e "const a=require('./data/metadata/card-abilities.json'); const s=new Set(a.map(e=>e.slug)); const o=new Set(a.map(e=>e.order)); if(a.length!==14) throw new Error('expected 14 entries, got '+a.length); if(s.size!==14) throw new Error('duplicate slug'); if(o.size!==14) throw new Error('duplicate order'); console.log('OK 14 entries, unique slugs+orders');"

# 2. Corpus validation (the scaffold — run BEFORE ship). For each new matcher,
#    count matching cards across data/cards/*.json <entityType>[].cards[].abilities[]
#    and spot-check the samples. Expected: reveal 119, ko-a-wound 22, gain-a-hero 46.
#    (A throwaway node/python scan over the corpus; confirm no false positives /
#    false removals per the Locked-values scoping notes — for gain-a-hero, confirm
#    Hero is the object gained, not a counting noun in "gain a Wound … for each Hero".)

# 3. Registry build/tests unaffected (data-only, no code change)
pnpm --filter @legendary-arena/registry build 2>&1 | tail -3
pnpm --filter registry-viewer build 2>&1 | tail -3
# Expected: both exit 0 (no schema/code change)

# 4. R2 upload (export AWS_* from .env first; no --progress)
#    rclone copy data/metadata/card-abilities.json r2:legendary-images/metadata/ \
#      --header-upload "Cache-Control: no-cache" --ignore-times
#    Confirm the working-tree file matches intended live bytes BEFORE upload (clobber gotcha).

# 5. Live (post-upload; D-24026): open cards.legendary-arena.com → Effects dropdown shows
#    the 3 new chips; selecting each filters the grid to ~119 / 22 / 46 cards.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] 14 entries; the 11 existing byte-unchanged; 3 new entries verbatim per the Locked table
- [ ] All entries validate under `CardAbilityEntrySchema` (no dup slug/order)
- [ ] Corpus validation run: 119 / 22 / 46, each spot-checked for FP + FR
- [ ] `pnpm --filter @legendary-arena/registry build` + `pnpm --filter registry-viewer build` exit 0
- [ ] File uploaded to R2 (`Cache-Control: no-cache`; working-tree file confirmed correct pre-upload)
- [ ] `docs/ai/STATUS.md` entry names WP-730 + the 3 effects; records the D-24026 live-verify as operator-pending
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-730 node `📝` → `✅`, `pnpm roadmap:counts:write`, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-767:` for the data change, `SPEC:` for governance close (or a single Lightweight-lane two-commit topology)
- [ ] D-24026 live-verification: the 3 chips filter correctly on the deployed cards site (operator-pending)

## Vision Alignment

- **Clauses touched:** §10a (Registry Viewer public surface — `cards.legendary-arena.com`),
  §2 / §10 (card content discoverability).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it
  makes existing card content more discoverable via a filter; no gameplay, scoring, or
  monetization surface.
- **Non-Goal proximity:** none of NG-1..NG-8 — a read-only discovery filter, no
  pay-to-win, no game-state.
- **Determinism preservation:** N/A — no engine / `G` / RNG / replay surface (a static
  data taxonomy consumed by the viewer).

## Funding Surface Gate

**N/A** — a card-discovery filter on the registry viewer; no §20.1 trigger (no funding
affordance, navigation, profile, or donate copy). Authority: WP-097 / D-9701 / D-9801.

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function; the taxonomy is
an R2 static asset. `docs/ai/REFERENCE/api-endpoints.md` unaffected.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 Structure** — PASS (all sections; Out of Scope lists 5). **§2 Constraints** —
  PASS (engine-wide + packet-specific + session protocol + locked values; references
  `00.6-code-style.md`; full-file output). **§3 Assumes** — PASS (WP-125, R2 fetch, the
  corpus). **§4 Context** — PASS (specific files + the R2 memory; 00.2 N/A — no new data
  shape, entries validate under the existing `CardAbilityEntrySchema`). **§5 Files** —
  PASS (1 data file + governance; bounded). **§6 Naming** — PASS (kebab slugs;
  `card-abilities.json` path exact). **§7 Deps** — PASS (none new; rclone is an existing
  op tool). **§8 Boundaries** — PASS (registry-viewer data only; no engine/server/DB).
  **§9 Windows** — PASS (rclone AWS_* env note). **§10 Env** — PASS (AWS_ACCESS_KEY_ID /
  AWS_SECRET_ACCESS_KEY from `.env`, documented; no secret printed). **§11 Auth** — N/A.
  **§12 Test Quality** — N/A (no test file; the corpus-validation scaffold is the check).
  **§13 Verification** — PASS (exact commands + expected output). **§14 AC** — PASS (6
  binary, observable). **§15 DoD** — PASS (STATUS + indices + mindmap + D-24026; surface
  = `cards.legendary-arena.com`, live-verify item present). **§16 Code Style** — PASS
  (JSON data; matcher patterns documented). **§17 Vision** — present (§10a). **§18
  Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A
  (justified). **§21 API Catalog** — N/A (justified).

No ❌ FAIL triggers. Gate satisfied.

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-09-21)

Dependencies verified on `main`: the Effects filter (WP-125) — `card-abilities.json`
(11 entries), `CardAbilityEntrySchema`, the R2-fetch client — are all present. The
three matchers were **corpus-validated at draft time** against the 2,970-card ability
corpus: reveal-top-of-your-deck 119 (the broad `reveal the top` = 247 is deliberately
narrowed to the player's own deck), gain-a-hero 46 (0 false positives — Hero is the
object gained, not a counting noun), ko-a-wound 22 (distinct from the marker syntax and
from ko-from-hand). **Empirical
Scaffold DONE at draft** (the counts + FP/FR spot-check above) — this is the required
scaffold for a matcher change, so execution re-runs it as a confirmation, not a
discovery. Single layer (registry-viewer data), strictly additive, no schema change →
Lightweight-lane eligible. One RS folded: the Reveal scope decision (your-deck vs any
deck) is locked to your-deck in §Scope/§Out-of-Scope.

### Copilot (`01.7`) — verdict: **PASS** (2026-09-21)

Layer boundary (registry-viewer data only; no engine/server/registry-code edge),
additivity (11 existing entries byte-unchanged; append-only), matcher fidelity (each
scoped + corpus-validated for false positives AND false removals — the #2078 discard
lesson is an explicit guardrail), and the R2-upload-is-done + clobber-gotcha discipline
all clear. Third-effect swap (2026-09-21): `defeat-mastermind` (only 5 cards) was
replaced with `gain-a-hero` (46 cards) at operator request; the new matcher was
corpus-scanned for the "gain a Wound … for each Hero" false-positive class (zero found).
No pay-to-win / determinism / persistence surface.
