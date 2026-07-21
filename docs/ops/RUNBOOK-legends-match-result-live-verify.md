# Operator Runbook — Enable & Live-Verify the Hall of Legends Match-Result View

**Purpose:** Close the **AC-6 / D-24026 live-verification** left open by **WP-407**
(the per-match result view) and **WP-408** (the portable LAGN download). Both
shipped as code on `main`, but their user-visible surface —
`legends.legendary-arena.com` — cannot render a real roster until one **build-time
env var** is set on the legends-board Cloudflare Pages project and the server
carrying the WP-407 CORS origin is deployed.

This document is **operational, not architectural**. It is subordinate to
`docs/ai/ARCHITECTURE.md` and `.claude/rules/`. Related:
[`DOMAINS.md`](./DOMAINS.md), `docs/ai/STATUS.md` (the WP-407/408 pending lines).

---

## TL;DR — Recommendation

1. On the **`legendary-arena-legends`** Cloudflare Pages project, set the
   **Production** build-time env var:

   ```
   VITE_LEGENDS_API_BASE_URL = https://api.legendary-arena.com
   ```

   (no trailing slash — the client appends `/api/match/:matchId/result-lagn`.)
2. **Redeploy legends-board** (Vite inlines the var at build time, so a config
   change alone does nothing until a rebuild).
3. Confirm the **server deploy** carrying the WP-407 CORS origin
   (`legends.legendary-arena.com`) is live on `api.legendary-arena.com`.
4. Find a **completed match with a claimed-handle participant** (query in
   [§Find a verifiable match](#find-a-verifiable-match)), open its result view,
   confirm the roster renders, and download the `.lagn.json`.
5. Flip the two `STATUS.md` live-verify lines to done and record the env var in
   [`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md).

**Risk: low.** Everything here is read-only. The endpoint is guest-readable and
credential-free; the env var only tells the static bundle which API origin to call;
removing it degrades the view to a visible "Result unavailable" state (no data loss).

---

## The problem, precisely

`apps/legends-board` fetches the WP-406 producer
`GET /api/match/:matchId/result-lagn` **live**, cross-origin, from
`legends.legendary-arena.com` → `api.legendary-arena.com`. Two independent config
facts gate a working render:

1. **The API origin** — legends-board reads `import.meta.env.VITE_LEGENDS_API_BASE_URL`
   (`apps/legends-board/src/panels/matchResultClient.ts` /
   `matchResultDownload.ts`). Vite **inlines** it at build time. If unset, the panel
   throws and shows `VITE_LEGENDS_API_BASE_URL is not set…`. Before WP-407 the app
   only used `VITE_LEGENDS_R2_BASE_URL` + `VITE_LEGENDS_POLL_INTERVAL_MS`, so this
   var is **new** and not yet configured.
2. **CORS** — the browser will not read a cross-origin response unless the server
   allowlists the caller's Origin. WP-407 added `https://legends.legendary-arena.com`
   (+ the `legendary-arena-legends.pages.dev` alias) to the boardgame.io CORS
   `origins` list in `apps/server/src/server.mjs`. That allowance is only in effect
   once the **server** is deployed with that commit.

Both must be true, and a **completed match with a claimed handle** must exist, or
the populated-roster path (the terminal AC-6 action) cannot be observed.

---

## Prerequisites

- [ ] WP-406 (#883), WP-407 (#885), WP-408 (#886) are on `main` — **done**.
- [ ] The **server** deploy on `api.legendary-arena.com` includes the WP-407 CORS
      origin commit (`main` @ `3b4c92f1` or later). Confirm the Render service
      `legendary-arena-server` redeployed after that merge.
- [ ] Access to the Cloudflare Pages dashboard for `legendary-arena-legends`.
- [ ] Read access to the production database (to find a verifiable match), or a
      known completed competitive match id whose player claimed a handle.

---

## Procedure

### Phase 0 — Baseline (before touching anything)

- Note the current legends-board deploy: `legends.legendary-arena.com` → footer
  version badge shows the built commit SHA. Record it for rollback.
- Open the browser devtools console on `legends.legendary-arena.com/#/match/anything`
  and confirm the **current** failure mode is `Result unavailable` with the
  `VITE_LEGENDS_API_BASE_URL is not set` detail (proves the var is the gap, not CORS).

### Phase 1 — Set the env var and redeploy legends-board

1. Cloudflare dashboard → **Workers & Pages** → **`legendary-arena-legends`** →
   **Settings** → **Environment variables** → **Production**.
2. Add: name `VITE_LEGENDS_API_BASE_URL`, value `https://api.legendary-arena.com`
   (no trailing slash). Save.
3. **Deployments** → **Retry deployment** (or push a trivial redeploy) so Vite
   rebuilds with the var inlined. A settings change alone does **not** rebuild.
4. When the deploy finishes, hard-reload `legends.legendary-arena.com` and confirm
   the footer SHA advanced.

### Phase 2 — Confirm the server (CORS) is deployed

- Confirm the `legendary-arena-server` Render service is running `main` @ `3b4c92f1`
  or later. Quick check from a shell:

  ```bash
  curl -si https://api.legendary-arena.com/api/match/__none__/result-lagn \
    -H 'Origin: https://legends.legendary-arena.com' | grep -i 'access-control-allow-origin'
  ```

  Expect `access-control-allow-origin: https://legends.legendary-arena.com` in the
  response headers (the body will be `404 not_found` for the bogus id — that is
  fine; you are checking the CORS header, not the body).

### Phase 3 — Find a verifiable match

See [§Find a verifiable match](#find-a-verifiable-match) for the SQL. You need a
`match_id` that is **finished** (`metadata` has `gameover`) **and** has at least one
seat whose account claimed a `display_handle`. Bots/guests and unclaimed accounts
render as `Anonymous`, so a match with only those will render (correctly) an
all-anonymous roster — not a failure, but not proof the handle path works.

### Phase 4 — Live-verify (drive the terminal action)

**WP-407 (AC-6):**
1. Open `https://legends.legendary-arena.com/#/match/<matchId>`.
2. Confirm the panel shows the **outcome** (Victory / Defeat / Draw) and a
   **roster** with the claimed handle (and `@handle` sub-label if a display name is
   set). An omitted seat shows `Anonymous`.
3. Devtools console: **no CORS error**, no red fetch failure.

**WP-408 (AC-6):**
4. Click **"Download this match as LAGN"**. Confirm a `match-<id>.lagn.json`
   downloads.
5. Validate it round-trips: either re-open it in the Registry Viewer via the
   `?lagn=` flow, or run the CLI:

   ```bash
   npx @legendary-arena/lagn validate match-<id>.lagn.json   # expect exit 0, "✓ Valid LAGN file"
   ```

6. Force the failure path once (optional): open `#/match/<a-nonexistent-id>` — the
   view must show the non-crashing "No result to show" empty state, and the download
   button must not be present (there is no result to download).

### Phase 5 — Record & close

- Flip the two `docs/ai/STATUS.md` live-verify lines (WP-407, WP-408) from
  *pending* to done, citing the deployed legends-board SHA and the verified
  `match_id`.
- Record the env var in [`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md)
  (`VITE_LEGENDS_API_BASE_URL` on `legendary-arena-legends`, Production).

### Rollback

- Remove the `VITE_LEGENDS_API_BASE_URL` env var and redeploy: the match-result
  view degrades to the visible `Result unavailable` state; every other legends-board
  panel (all R2-snapshot-driven) is unaffected. No data risk — the whole surface is
  read-only.

---

## Find a verifiable match

A completed match with at least one claimed-handle seat. Run against the production
database (read-only):

```sql
SELECT m.match_id,
       count(*) FILTER (WHERE p.display_handle IS NOT NULL) AS claimed_seats
FROM bgio.matches m
JOIN legendary.match_seat_accounts msa ON msa.match_id = m.match_id
JOIN legendary.players p ON p.ext_id = msa.account_id
WHERE m.metadata ? 'gameover'                 -- finished
GROUP BY m.match_id
HAVING count(*) FILTER (WHERE p.display_handle IS NOT NULL) >= 1
ORDER BY m.match_id
LIMIT 5;
```

Any returned `match_id` will render a non-empty roster. If the query returns **no
rows**, no completed match has a claimed-handle participant yet — the handle-path
AC-6 cannot be observed until one exists; verify the empty/error states (Phase 4
step 6) in the meantime and re-run this query later.

---

## Env-var / config change matrix

| Where | Key | Value | Why |
|---|---|---|---|
| CF Pages `legendary-arena-legends` (Production) | `VITE_LEGENDS_API_BASE_URL` | `https://api.legendary-arena.com` | The server API origin legends-board fetches `result-lagn` from. Inlined by Vite at build → requires a redeploy. |
| Render `legendary-arena-server` | (code) CORS `origins` | `https://legends.legendary-arena.com` (+ `.pages.dev` alias) | Allows the cross-origin browser fetch. Shipped in WP-407 (`server.mjs`); live once the server is deployed at `main` ≥ `3b4c92f1`. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Result unavailable` + `VITE_LEGENDS_API_BASE_URL is not set` | Env var missing or not redeployed | Phase 1 — set it, then **redeploy** (rebuild required). |
| Console CORS error (`No 'Access-Control-Allow-Origin'`) | Server not deployed with the WP-407 origin | Phase 2 — redeploy `legendary-arena-server` at `main` ≥ `3b4c92f1`. |
| Roster renders but every seat is `Anonymous` | No claimed-handle participant in that match | Not a bug (D-24216 omits handleless seats). Pick a match from the §Find query. |
| `No result to show` empty state | Match unknown or still in progress (WP-406 returns 404) | Use a finished `match_id` (the SQL filters on `gameover`). |
| Download button does nothing / errors | Transient fetch failure | The panel shows a full-sentence error by design; retry. Check the server is up. |

---

## Sources

- WP-407 / EC-442 (result view), WP-408 / EC-443 (download); D-24216 / D-24217 /
  D-24218 in `docs/ai/DECISIONS.md`.
- `apps/legends-board/src/panels/matchResultClient.ts`,
  `matchResultDownload.ts` (the `VITE_LEGENDS_API_BASE_URL` reads).
- `apps/server/src/server.mjs` (the CORS `origins` list).
- [`DOMAINS.md`](./DOMAINS.md) — `legends.*` (Pages) and `api.*` (Render) hosts.
