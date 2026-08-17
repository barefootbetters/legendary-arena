# EC-600 — VP Icon Marker Mismap

**WP:** [WP-565](../work-packets/WP-565-vp-icon-marker-mismap.md)
**Layer:** Card Data + Build Tooling (no engine, no client)
**Lane:** Standard two-session
**Reserves:** D-24374

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [ ] Record baselines: both sentinel hash values, and all four derived-feed
      `:check` scripts green (`mechanics:metadata`, `ledger:heroes`,
      `ledger:villains`, `effect-index`).
- [ ] Read WP-565 §Scaffold Findings before touching anything — it is the reason
      this EC forbids regeneration.
- [ ] Target file set is EXACTLY: `scripts/convert-cards/convert-cards-v15.mjs`,
      the 12 `data/cards/*.json` files below, and one drift-test file. Anything
      else is a FAIL, not a judgment call.

## Locked Values

- `ICON_SLUG_MAP[4]` becomes `'vp'`. Entries `1: attack`, `2: recruit`,
  `3: vp` are UNCHANGED.
- Affected sets (12): `2099`(2), `3dtc`(1), `amwp`(9), `core`(2), `dkcy`(4),
  `msp1`(1), `noir`(2), `pttr`(2), `ssw2`(5), `vill`(1), `wpnx`(2), `xmen`(4).
- Total occurrences **35**; changed lines **34** (two occurrences share a line).
- The substitution is exactly `[icon:piercing]` → `[icon:vp]`. Nothing else.

## Guardrails

1. **DO NOT REGENERATE `data/cards/*.json`.** The pipeline does not reproduce
   the committed data: the converter alone strips every `[keyword:…]` marker,
   and the full 5-stage run deletes mastermind-strike entries in `ssw1`/`xmen`.
   Regeneration is data loss. Edit the 12 files in place.
2. **The map fix is forward-looking only.** `4: 'vp'` exists so a FUTURE
   regeneration is correct. Do not run the pipeline to "apply" it.
3. **Display-only.** No `vp` field value changes, no engine file, no client file.
   `[icon:vp]` is already supported client-side.
4. **No derived-feed regeneration.** All four gates stay clean without it
   (proven by scaffold). If one goes red, STOP — something outside scope moved.
5. **Both hash oracles must stay byte-unchanged.** This WP touches no `G`
   surface. A moved oracle is a STOP, never a re-pin.
6. **The drift test must be non-vacuous.** It asserts zero `[icon:piercing]` in
   `data/cards/**` AND carries a negative assertion proving it fails against a
   synthetic string containing the marker.
7. `piercing` stays a legal marker slug — do not delete it from any icon table.

## Required Comments

- `// why:` on `ICON_SLUG_MAP[4]`, recording that all 22 upstream `{ icon: 4 }`
  uses were audited individually and every one is a victory-point context, so
  the slug is `vp` and not `piercing`.
- `// why:` on the drift test, naming that the marker reached players as the
  wrong resource for 35 ability texts and that scoring was never affected.

## Files to Produce

| File | Change |
|---|---|
| `scripts/convert-cards/convert-cards-v15.mjs` | `ICON_SLUG_MAP` `4: 'vp'` + `// why:` |
| `data/cards/2099.json` … `xmen.json` (the 12 listed) | 35 marker replacements |
| a card-data drift test | **new** — zero `[icon:piercing]` + negative assertion |

## After Completing

- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` no new failures.
- [ ] `grep -r "icon:piercing" data/cards/` returns zero matches.
- [ ] `git diff --numstat data/cards/` shows exactly 12 files / 34 / 34.
- [ ] All four derived-feed `:check` scripts exit 0 **with no regeneration run**.
- [ ] Both sentinel oracles confirmed byte-unchanged.
- [ ] **D-24374** Active, recording the 22-of-22 audit and the regeneration ban.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; `docs/05-ROADMAP-MINDMAP.md`
      node `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` states both oracles unchanged and no feed regenerated.
- [ ] Live-on-surface verification (D-24026) recorded or operator-pending.

## Common Failure Smells

- **Running the card pipeline "to be safe."** It is the one thing this EC
  forbids; it silently strips markers and drops cards.
- **Regenerating a derived feed because a card file changed.** Usually right,
  wrong here — the icon marker feeds none of the four.
- **Re-pinning a hash oracle.** Nothing in scope touches `G`; a moved oracle
  means the scope was exceeded.
- **A drift test that only asserts the happy path.** It must fail on a synthetic
  bad input or it is not guarding anything.
- **Deleting `piercing` from the icon tables.** It stays valid; only its current
  card-text uses are wrong.
