# 11 — Troubleshooting

> Common issues, symptoms, root causes, and fixes for Legendary Arena.
>
> **Last updated:** 2026-04-14
>
> **First step for any problem:** Run `pnpm check:env` (no network) then
> `pnpm validate` (R2 data). These two commands catch most issues before
> you need to debug anything else.

---

## Quick Diagnostic Sequence

Run these in order when something breaks:

```pwsh
# 1. Local tooling (no network needed)
pnpm check:env

# 2. Build all packages
pnpm -r build

# 3. Run all tests (314 engine + 6 server + 3 registry)
pnpm test

# 4. R2 card data integrity
pnpm validate

# 5. External service connections (needs .env)
pnpm check
```

If steps 1-3 pass, the problem is likely in R2 data or external services.
If step 2 or 3 fails, the problem is in code.

---

## Environment & Setup Issues

### `pnpm check:env` fails

| Symptom | Cause | Fix |
|---|---|---|
| `node NOT FOUND on PATH` | Node.js not installed | Install v22+ from [nodejs.org](https://nodejs.org) |
| `pnpm NOT FOUND on PATH` | pnpm not installed globally | `npm install -g pnpm` |
| `dotenv NOT FOUND on PATH` | dotenv-cli not installed | `npm install -g dotenv-cli` |
| `dotenv below required v16` | False alarm — dotenv-cli v11+ removed `--version` | Ignore; script detects version via `npm list` |
| `.env file not found` | Haven't created it yet | `Copy-Item .env.example .env` then edit |
| `PLACEHOLDER` on a variable | `.env` still has example values | Replace `your-32-byte-hex-string-here` etc. with real values |
| `rclone config not found` | rclone not configured | `rclone config` and create an `r2` remote |
| `boardgame.io NOT FOUND` | Package not installed | `pnpm install` from repo root |
| `zod NOT FOUND` | Package not installed | `pnpm install` from repo root |

### `pnpm check` fails

| Symptom | Cause | Fix |
|---|---|---|
| PostgreSQL connection failed | PostgreSQL not running or `DATABASE_URL` wrong | Start PostgreSQL; see [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) §3a |
| boardgame.io server unreachable | Game server not running | `node --env-file=.env apps/server/src/server.mjs` |
| R2 `metadata/sets.json` returned 404 | R2 bucket misconfigured or URL wrong | Verify `R2_PUBLIC_URL` in `.env` is `https://images.barefootbetters.com` |
| GitHub API rate limited | Too many unauthenticated requests | Wait a few minutes; rate limit resets hourly |
| Git remote mismatch | origin URL doesn't match expected | `git remote set-url origin https://github.com/barefootbetters/legendary-arena` |
| rclone cannot list bucket | rclone remote misconfigured | `rclone config` — verify the `r2:` remote has correct credentials |

---

## R2 Validation Issues

### `pnpm validate` errors

| Symptom | Cause | Fix |
|---|---|---|
| "Registry fetch failed" | R2 rate limit or network issue | Wait 30 seconds and retry |
| "Metadata fetch failed: HTTP 404" | Set JSON not uploaded to R2 | Upload via `rclone copy data/cards/{abbr}.json r2:legendary-images/metadata/` |
| Hero/mastermind/villain "missing slug" | Data defect in card JSON | Fix in `data/cards/{abbr}.json`, re-run `convert-cards-v15.mjs`, re-upload |
| "henchmen key exists but is not an array" | Corrupt set JSON | Regenerate from source data |

### `pnpm validate` warnings (informational — do NOT block)

| Warning | Meaning | Action |
|---|---|---|
| `[object Object]` in abilities | R2 metadata has serialization artifacts | Re-run `convert-cards-v15.mjs` for affected set, re-upload |
| Missing cost/hc on a card | Transform card back-face (minimal record) | Expected — not a defect |
| Cross-set duplicate slugs | Same hero appears in multiple sets | Expected (e.g., `black-widow` in core, 3dtc, msp1, bkwd) |
| Mastermind missing VP | Some cards have no VP printed | Expected for mgtg Ronan/Ego — `null` is correct |

### Silent registry failures

**Symptom:** Registry loads successfully but contains zero sets.

**Cause (historical):** Fetching a metadata file with the wrong shape
where `sets.json` was expected — every entry fails `SetIndexEntrySchema`
silently (missing `abbr` / `releaseDate`) and Zod drops them with no
error thrown. The canonical counter-example was `card-types.json`
(deleted by WP-084 on 2026-04-21; D-1203 retains the narrative). The
silent-failure pattern still applies to any future metadata file with
a compatible-looking shape.

**Fix:** Ensure loaders fetch `metadata/sets.json` for the set index.
See ARCHITECTURE.md §Section 2 "Registry Metadata File Shapes".

---

## R2 Image Issues

| Symptom | Cause | Fix |
|---|---|---|
| Image 404 on a card | Image not uploaded or filename mismatch | Check the `imageUrl` field in the card JSON. Upload the correct file to R2. |
| Mastermind image 404 | Some masterminds have no base card (tactic-only) | Not a bug — Hydra High Council, Sinister Six 2099 only have tactic cards |
| Villain image 404 with slug mismatch | Slug has dots/periods stripped differently in image vs JSON | Fix the slug or image filename to match. Use hyphens, not underscores. |
| Images appear stale after upload | R2 CDN cache | Wait a few minutes for propagation. Cache-bust with `?t=<timestamp>` for verification. |

---

## Commit & Git Issues

| Symptom | Cause | Fix |
|---|---|---|
| "Subject does not match an allowed prefix" | Missing `EC-###:`, `SPEC:`, or `INFRA:` | Add the correct prefix to your commit message |
| "Subject contains a forbidden pattern" | Used `WIP`, `misc`, `tmp`, etc. | Write a specific, present-tense description |
| "Subject too short after prefix" | Description under 12 characters | Be more specific about what changed |
| "No EC file found for EC-###" | Referenced EC doesn't exist | Create the EC first, or use `INFRA:` for non-EC work |
| "Code changes detected but commit is not EC-scoped" | Files under `packages/` or `apps/` staged with `SPEC:` or `INFRA:` | Use `EC-###:` prefix for code changes |
| `.env.example` blocked by pre-commit | Outdated hook version | Pull latest — fixed in commit `220a166` |
| Hooks not running | `core.hooksPath` not set | `pwsh scripts/git/install-ec-hooks.ps1` |

### Dry-run commit check

Validate a message without committing:

```pwsh
pwsh scripts/git/ec-commit.ps1 -Check -Message "EC-010: wire endIf to evaluateEndgame"
```

---

## Registry Viewer Issues

| Symptom | Cause | Fix |
|---|---|---|
| Viewer shows no sets | R2 unreachable or wrong URL | Check browser console for fetch errors. Verify R2 URL. |
| Cards load but images are broken | Image URL uses wrong pattern | Check `imageUrl` field in R2 metadata JSON |
| Viewer doesn't start | Node modules missing | `pnpm install` then `pnpm viewer:dev` |

---

## EC-Mode Debugging

Under EC-mode, debugging follows the clause-driven protocol in
`docs/ai/REFERENCE/01.2-bug-handling-under-ec-mode.md`:

1. **Do NOT** open the code first
2. **Do NOT** add logs or debug helpers
3. Open `EC_INDEX.md` → locate the governing EC
4. Identify the violated clause (Locked Value? Guardrail? Required file?)
5. If the EC has a "Common Failure Smells" section, check symptoms there
6. Fix the specific clause violation
7. Re-run build/tests and re-check the EC

**Key principle:** Every bug is either an implementation violation (code
fails to satisfy a valid EC clause) or a specification error (the EC/WP
has an inconsistency). There is no third category.

---

## Game Engine Issues

| Symptom | Cause | Fix |
|---|---|---|
| `Game.setup()` throws "invalid ext_id" | `MatchSetupConfig` IDs don't match registry | Verify scheme/mastermind/group IDs exist in the registry |
| Move returns void silently (no mutation) | Wrong `G.currentStage` for that move | Check `MOVE_ALLOWED_STAGES` — e.g., `playCard` requires `'main'` |
| Server logs "rules loaded: 0 rules" | PostgreSQL `legendary.rules` table empty | Run `psql -U postgres -d legendary_arena -f data/seed_rules.sql` |
| "G is not JSON serializable" | Maps, Sets, functions, or class instances in `G` | All G fields must be plain JSON (strings, numbers, arrays, objects) |
| Drift-detection test fails | Canonical array doesn't match union type | Update BOTH the union type and its canonical array in the same change |
| `pnpm --filter @legendary-arena/game-engine build` fails | TypeScript error in new code | Read the error; check imports respect layer boundaries |
| Tests fail after adding field to `LegendaryGameState` | Existing test mocks missing the new field | Guard access with `?? defaultValue` for backward compatibility |
| Hero effect doesn't fire | `G.heroAbilityHooks` missing or card not in hooks | Check `buildHeroAbilityHooks` extracts the card; check keyword spelling |
| Board keyword not applied | `G.cardKeywords` empty for the card | Check `buildCardKeywords` — only Ambush extractable from real data at MVP |

## Future Issues (Not Yet Built)

| Symptom | When it applies | Reference |
|---|---|---|
| Replay verification fails | After WP-027 | Check for `Math.random()` or direct `G` mutation |
| Client UI state mismatch | After WP-028+ | Client reflects server state; check network sync |

---

## When to Ask for Help

1. Run the Quick Diagnostic Sequence above
2. Capture the exact error message
3. Include the output of `pnpm validate` and `pnpm check:env`
4. Check `docs/ai/STATUS.md` for the current project state
5. Open an issue at `github.com/barefootbetters/legendary-arena/issues`

---

**See also:**
- [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) — setup and verification
- [07-CLI-REFERENCE.md](07-CLI-REFERENCE.md) — all available commands
- [03-DATA-PIPELINE.md](03-DATA-PIPELINE.md) — R2 data and image patterns
- [ai/REFERENCE/01.2-bug-handling-under-ec-mode.md](ai/REFERENCE/01.2-bug-handling-under-ec-mode.md) — EC-mode debugging protocol
