# EC-873 — co2e Villains and Henchmen: Mark the Covered Timing Lines (Execution Checklist)

**Source:** docs/ai/work-packets/WP-835-co2e-villains-mark-covered-lines.md
**Layer:** Card Data (Registry input) only — NO engine change

## Before Starting
- [ ] Jeff has given the go to execute; baseline is `origin/main` at or after the WP-835 draft SPEC.
- [ ] `node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); console.log(Object.keys(m.villains.co2e), Object.keys(m.henchmen.co2e))"` prints the existing co2e groups (`masters-of-evil`, `skulls`; `doombot-legion`).
- [ ] If any of WP-836..840 merged first, its rows may already sit in the same `co2e` card objects (WP-837 Juggernaut / Mystique / Scorpion Ambush, WP-836 Beetle Fight, WP-838 / WP-839 rows): merge into the existing objects, never replace them.
- [ ] `pnpm -r build` 0 and `pnpm -r --no-bail test` 0 fail on the baseline (record the totals).

## Locked Values (do not re-derive)
- `villains.co2e` rows (card slug → timing → token list, in order):
  - `brotherhood-of-mutants`: `juggernaut` fight `["ko-hero:current:2"]`; `mystique` escape `["become-scheme-twist"]`; `sabretooth` ambush + escape `["reveal-or-wound:hc:instinct"]`
  - `hydra`: `endless-armies-of-hydra` fight `["koHeroEachPlayer", "play-villain-deck-cards:2"]`; `viper` fight + escape `["gain-wound-unless-victory-villain-group:hydra"]`
  - `radiation`: `maestro-wasteland-hulk` fight `["ko-heroes-current-count-by-trait:hc:strength"]`; `zzzax` fight + escape `["reveal-or-wound:hc:strength"]`
  - `sinister-spider-foes`: `scorpion` fight `["koHeroCurrentPlayer"]`; `the-lizard` fight `["ko-hero:current@sewers", "gain-wound:each-other@sewers"]`
  - `sinister-syndicate`: `beetle` escape `["reveal-or-wound:hc:covert"]`; `hydro-man` fight `["ko-hero:current@sewers+bridge"]`
  - `skulls` (add beside `paibok-the-power-skrull`): `skrull-queen-veranke` ambush `["captureHqHeroHighestCost"]` + fight `["gain-attached-hero"]`; `skrull-shapeshifter` ambush `["captureHqHeroRightmost"]` + fight `["gain-attached-hero"]`; `super-skrull` fight `["koHeroCurrentPlayer"]`
- `henchmen.co2e.hand-ninjas` fight `["ko-hero:current@sewers+rooftops", "gain-recruit-current:1@bank+streets+bridge"]`
- Expected run output: `co2e.json — 23 new marker(s)`, every other set `0`; second run `0`.
- Magnitude 1 is the bare token; never `ko-hero:current:1` (rejected, D-24298).
- KO-or-gift (Veranke, Shapeshifter) = the fighting player gains it (D-24335 collapse; award is the generic `awardAttachedHeroes`).
- Viper's predicate is set-scoped (D-24299 Path B): co2e Viper counts only co2e HYDRA Villains. Accepted residual; no code change.

## Guardrails
- Card data only: no `packages/**` source or test change, no new primitive, no `mechanic-provenance.json` row.
- Mark only the 20 lines above. The 24 lines owned by WP-836..840 and the variable-Attack passives stay unmarked.
- Hand-edit the marker map in its existing formatting; do not re-serialize the file (a full re-serialize rewrites ~1,500 lines).
- A token that fails `apply-effect-markers.mjs` validation or yields `unresolvedMarkers` → STOP; that line belongs to an engine WP.
- Regenerate derived artifacts only with their scripts (`ledger:villains`, `effect-index`); revert CRLF-only churn (`git diff --numstat`).
- Hashed oracles: confirm no `finalStateHash` / `PRE_WP080_HASH` / sentinel fixture uses an in-scope co2e group; re-record via the canonical tool only if one shifts.

## Required Comments
- None in code (no code changes). The commit body names D-24768 and the 23-marker count.

## Files to Produce
- `scripts/convert-cards/inputs/villain-effect-markers.json` (modified)
- `data/cards/co2e.json` (regenerated)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv` (regenerated)
- `data/metadata/effect-implementation-index.json` (regenerated)
- Governance (SPEC close): `DECISIONS.md` D-24768, `NUMBER-LEDGER.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] `apply-effect-markers.mjs` → `co2e.json — 23 new marker(s)`; re-run → `0`
- [ ] A throwaway `buildVillainAbilityHooks` probe (or the setup suite) shows every co2e hook parses with no `unresolvedMarkers`
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail, no test file changed
- [ ] `cards:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `gauntlet:loadouts:check`, `gauntlet:configs:check`, `sim:runtime-observed:check`, `sim:coverage -- --check`, `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` all 0
- [ ] Villain ledger: 15 `(unmarked)` rows removed (one fewer per mixed card WP-836 / WP-837 already flipped), 20 `executable` rows added (18 villain + 2 Hand Ninjas) with their owning WP / D; the 13 all-out-of-scope cards + Savage Land Mutates keep `(unmarked)`
- [ ] `git diff --name-only` = Files to Produce
- [ ] Commits: `EC-873:` implementation, then `SPEC:` close (D-24768 Active, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ + `roadmap:counts:write`, ledger LANDED)
- [ ] D-24026 live-verify recorded operator-pending (WP-835 Verification 7)

## Common Failure Smells
- `co2e.json — 0 new marker(s)` → key path wrong (`villains → co2e → <group> → <card>`) or a slug typo (`maestro-wasteland-hulk`, `endless-armies-of-hydra`, `skrull-queen-veranke`).
- A loud fail naming `ko-hero:current:1` → magnitude-1 written with a count; use the bare token.
- Hand Ninjas Core row changed → the edit landed under `henchmen.core`; co2e henchmen live under `henchmen.co2e`.
- `ledger:villains:check` red after the marker edit → the ledger was not regenerated.
- ~1,500-line diff on the marker map → the file was re-serialized; restore and hand-edit.
