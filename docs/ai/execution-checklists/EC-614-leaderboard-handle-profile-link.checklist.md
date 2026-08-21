# EC-614 — Legends Leaderboard: Claimed Handle as a Profile Link (Execution Checklist)

**Source:** docs/ai/work-packets/WP-579-leaderboard-handle-profile-link.md
**Layer:** Cross-cutting — Server (`apps/server`) + App (`apps/legends-board`)

## Before Starting
- [ ] Preconditions A–D in WP-579 all pass (query selects only `display_name`; snapshot sets `handle: entry.playerDisplayName`; `PublicLeaderboardEntry` is the 9-field D-5201 lock with no id; client mirror + profile route + `handle_canonical` column exist)
- [ ] Confirm with the operator and lock in D-24388 BEFORE editing: (a) the source seam — **Path A** (snapshot-only, recommended) vs **Path B** (widen `PublicLeaderboardEntry` + D-5201 amendment + §21 four-row); (b) the unclaimed-handle fallback (neutral non-PII label, no link, no email-local-part)
- [ ] `pnpm --filter @legendary-arena/server build` exits 0 (baseline)
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` exits 0 (baseline)

## Locked Values (do not re-derive)
- Claimed-handle columns: `display_handle` (display form) + `handle_canonical` (URL key), on `legendary.players`, nullable until claimed.
- Profile URL: `https://play.legendary-arena.com/?profile=<handle_canonical>`, handle percent-encoded.
- Snapshot entry types today set `handle: entry.playerDisplayName` (`legends.logic.ts` builders, explicit object literals — no spread).
- Snapshot change is ADDITIVE-OPTIONAL with **NO `schemaVersion` bump** — `schemaVersion` stays the literal `1` (house convention, WP-342/344/385/472/474).
- **Path A default:** `PublicLeaderboardEntry` (D-5201, 9 fields) and the four `Wired` HTTP leaderboard endpoints stay UNTOUCHED.
- Fallback (D-24388, operator-locked): unclaimed → neutral non-PII label, plain text, NO link; do NOT emit the email-local-part `display_name` to these boards.

## Guardrails
- **Move the client mirror in lockstep.** `apps/legends-board/src/snapshots/snapshotClient.ts` mirrors the snapshot entry types ("DO NOT import from @legendary-arena/server"); its optional `handle`/`handleCanonical` MUST be added in the same commit or the board typecheck fails / the link field is silently `undefined`.
- Do NOT bump `schemaVersion` — additive-optional only.
- **Path A:** do NOT widen `PublicLeaderboardEntry` and do NOT touch the four HTTP leaderboard endpoints or `api-endpoints.md`. If Path B is operator-chosen, amend D-5201 AND replace the four catalog rows whole (§21, D-11804).
- Do NOT change score computation, ranking, ordering, `is_ranked_eligible`, or visibility filters.
- Do NOT change the publisher cadence (5-min) or the board's 60s manifest poll; do NOT alter `legendary.competitive_scores` — NO migration.
- NEVER drop a ranked row — an unclaimed handle still renders (fallback label).
- Do NOT touch the Gauntlet board (roster model, `gauntlet.logic.ts` source), the NowPlaying / RecentAchievements panels (latent), or the MatchResult panel (separate, already handle-based).
- `for...of` / explicit literals (no spread, EC-157) in builders; percent-encode the handle in the URL.
- §18 prose discipline: paraphrase any grep-policed token (e.g. the encode call) in `// why:` prose.

## Required `// why:` Comments
- On the fallback branch: why an unclaimed handle renders a neutral label and the email-local-part is withheld from these boards.
- On the URL construction: why the handle is percent-encoded (injection defense) — paraphrase the token per §18.

## Files to Produce
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **modified** — carry `display_handle` + `handle_canonical` from the JOIN into the snapshot-generation path (Path A: `PublicLeaderboardEntry` unchanged)
- `apps/server/src/legends/legends.types.ts` — **modified** — optional `handle` / `handleCanonical` on the snapshot entry types; NO version bump
- `apps/server/src/legends/legends.logic.ts` — **modified** — carry handle through builders + fallback
- `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** — mirror the optional fields (required by the "DO NOT import" boundary)
- `apps/legends-board/src/panels/OverallPanel.vue` — **modified** — handle as profile link / fallback
- `apps/legends-board/src/panels/WeeklyPanel.vue` — **modified** — same
- `apps/legends-board/src/panels/BySchemePanel.vue` — **modified** — same
- `apps/server/src/legends/legends.logic.test.ts` (or nearest existing legends/leaderboard test) — **modified** — handle carried + fallback
- `apps/legends-board/src/panels/<panel>.test.ts` — **modified** — link when claimed / plain when unclaimed
- `docs/ai/REFERENCE/api-endpoints.md` — **modified ONLY under Path B** (four leaderboard rows replaced whole, §21); untouched under Path A

## After Completing
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` exits 0
- [ ] `pnpm -r build && pnpm -r --no-bail test` — no new failures; server legends + board panel tests green
- [ ] `schemaVersion` unchanged (literal `1`); leaderboard ordering / eligibility / cadence unchanged; no competitive-scores migration
- [ ] Path A: `PublicLeaderboardEntry` + four endpoints + `api-endpoints.md` unchanged (§21 N/A). Path B: D-5201 amended + four rows replaced whole
- [ ] Gauntlet / NowPlaying / RecentAchievements / MatchResult surfaces untouched
- [ ] Live-on-surface (D-24026): legends.legendary-arena.com — a claimed-handle row on the global-top/scenario board links to `/?profile=<handle>` and resolves; an unclaimed row shows the fallback label
- [ ] `docs/ai/STATUS.md` updated (names WP-579; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24388 landed Active (+ D-5201 amendment under Path B)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-579 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- The board typecheck fails after the server type moves → the `snapshotClient.ts` mirror was not updated in lockstep.
- An email prefix appears on the board → the fallback still emits `display_name`; withhold it and render the neutral label.
- A row vanishes for an unclaimed player → the fallback drops the row instead of labelling it.
- `PublicLeaderboardEntry` or a leaderboard endpoint response changed under Path A → the D-5201 lock was breached; either revert to the snapshot-internal seam or switch to Path B with the amendment + §21 rows.
