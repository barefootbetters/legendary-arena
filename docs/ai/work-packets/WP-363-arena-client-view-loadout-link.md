# WP-363 — In-Match "View Loadout in Registry Viewer" Link (Arena Client)

**Status:** Draft 2026-07-11 · **⛔ BLOCKED on WP-361 (the endpoint) + WP-362 (the viewer ingest)** · **Standard two-session lane** (D-24028 — one pure encoder + one fetch wrapper + one fixed-position SFC + one PlayViewport mount). Pairs with **EC-393** (authored at execution-prep). Reserves **D-24155** (lands at execution).
**Primary Layer:** Arena Client (`apps/arena-client`)
**User-Visible Surface:** **play.legendary-arena.com** (a small in-match "View loadout in Registry Viewer" affordance that opens the current game's loadout in the viewer). **D-24026 live-verify APPLIES.**
**Dependencies:** **WP-361 ⛔** (`GET /api/match/:matchId/lagn` — the LAGN source); **WP-362 ⛔** (the viewer `?lagn=<base64url>` ingest — the link target + the encoding contract, D-24154); WP-228 (`DiagnosticExportButton` fixed-position play-surface mount idiom) ✅ **Done**; WP-301 (`buildApiUrl` + `Authorization: Bearer` authenticated-fetch pattern in `lib/api/`) ✅. **BLOCKED until WP-361 + WP-362 land.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution).

---

## Session Context

WP-361 exposes `GET /api/match/:matchId/lagn` (participant-gated Tier-1 LAGN) and WP-362 makes the Registry Viewer ingest a `?lagn=<base64url>` deep-link (D-24154 encoding); this packet is the play-surface half that fetches the former and opens the latter — mirroring the `DiagnosticExportButton` fixed-position mount (WP-228) and the `buildApiUrl` + Bearer authenticated-fetch pattern (WP-301).

---

## Goal

The arena client gains an in-match **"View loadout in Registry Viewer"** affordance on the play surface. On click it reads the active `matchId` from the URL, fetches the match's Tier-1 LAGN from WP-361's `GET /api/match/:matchId/lagn` (authenticated with the player's existing Hanko session bearer), base64url-encodes it into WP-362's `?lagn=` deep-link (the D-24154 encoding contract), and opens `https://cards…/?lagn=…` in a new tab. A fetch failure surfaces a brief, non-blocking inline message rather than breaking the match view. This closes the loop: any authenticated participant can open the exact loadout of the game they are in, in the Registry Viewer's Loadout tab.

---

## User-Visible Impact

During a live game on play.legendary-arena.com, a player sees a small "View loadout in Registry Viewer" control. Clicking it opens a new browser tab on the Registry Viewer's Loadout tab, pre-filled with this game's Mastermind, Scheme, villain/henchman groups, hero decks, supply counts, and player count — ready to inspect, tweak, or export. If the loadout can't be loaded (e.g. a transient network error), a short message appears next to the control and the match is unaffected.

---

## Assumes

- **WP-361 is live:** `GET /api/match/:matchId/lagn` returns `200 { lagn: LAGN }` for an authenticated participant, `401`/`403`/`404` otherwise, `Cache-Control: no-store`. (BLOCKING dependency.)
- **WP-362 is live:** the Registry Viewer reads `?lagn=<base64url(UTF-8 LAGN JSON)>`, decodes it, and opens the Loadout tab pre-filled (D-24154 encoding). This packet's encoder MUST be the exact inverse of WP-362's decoder. (BLOCKING dependency.)
- **`buildApiUrl(path)` + Bearer auth exist** — `apps/arena-client/src/lib/api/apiBaseUrl.ts` builds the server URL and authenticated calls send `Authorization: Bearer ${authToken}` (the `authToken: string | null` param pattern). This packet mirrors `loadoutLibraryApi.ts` exactly (never throws; non-200 → typed failure; network throw → `status: 0`). (Verified: `apps/arena-client/src/lib/api/loadoutLibraryApi.ts:136-156`.)
- **The current player's Hanko session bearer is reachable** the same way the loadout-library calls get their `authToken` (the existing session accessor). Every live-match seat is authenticated (WP-307/308), so the token is present during play. (Verified: `loadoutLibraryApi.ts` call sites.)
- **`matchId` is in the URL as `?match=`** and is read the same way `DiagnosticExportButton` reads it (`new URLSearchParams(window.location.search).get('match')`). (Verified: `apps/arena-client/src/components/DiagnosticExportButton.vue:44-46`.)
- **`PlayViewport.vue` mounts fixed-position play-surface siblings once** (`DiagnosticExportButton`, `HollowEffectsPanel`) for both the mobile and desktop surfaces. This packet adds one more. (Verified: `apps/arena-client/src/pages/PlayViewport.vue:123-132`.)
- **The SFC compile idiom is `defineComponent({ setup() { return {...} } })`** (the D-6512 vue-sfc-loader separate-compile rule the sibling buttons already follow). (Verified: `DiagnosticExportButton.vue:30`.)

If WP-361 or WP-362 is not live, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/components/DiagnosticExportButton.vue` — the fixed-position, `?match=`-reading, `defineComponent` SFC idiom to mirror (placement, matchId read, best-effort non-blocking behavior).
- `apps/arena-client/src/lib/api/loadoutLibraryApi.ts` + `apps/arena-client/src/lib/api/apiBaseUrl.ts` — `buildApiUrl` + `Authorization: Bearer` + the never-throws `{ ok, status }` result pattern to mirror for `fetchMatchLagn`.
- `apps/arena-client/src/pages/PlayViewport.vue` — the shared-root mount point (add one sibling, mirror the `DiagnosticExportButton` line + its `// why:` mount comment).
- `docs/ai/work-packets/WP-362-registry-viewer-lagn-url-ingest.md` §Contract + **D-24154** — the `?lagn=` param key and base64url(UTF-8 LAGN JSON) encoding this packet's encoder must produce.
- `docs/ai/work-packets/WP-361-match-lagn-endpoint-server.md` §Contract — the `GET /api/match/:matchId/lagn` response shape + status codes.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 11 (full-sentence errors), Rule 13 (ESM).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+; `node:` prefix where applicable; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- Full file contents for every new/modified file — no diffs, no snippets.

**Packet-specific:**
- **Encoder is the exact inverse of WP-362's decoder (D-24154).** base64url of `JSON.stringify(lagn)` (UTF-8): `btoa` over UTF-8 bytes → `+`→`-`, `/`→`_`, strip `=`. A round-trip test asserts WP-363-encode → WP-362-decode reproduces the original document.
- **No engine / `boardgame.io` / registry import.** The client never validates the LAGN (the server is the authority — it already `validate()`d in WP-361); the client only encodes an opaque document into a URL (same "opaque `lagn`" posture as `loadoutSummary.ts` / the loadout library, D-24085/WP-301).
- **`fetchMatchLagn` never throws.** Mirror `loadoutLibraryApi`: non-200 → `{ ok:false, status }`; a thrown fetch → `{ ok:false, status: 0 }`. The button maps any failure to a short inline message; it never rejects, never blocks the match.
- **Open in a new tab, safely.** `window.open(url, '_blank', 'noopener')` — `noopener` mandatory (no reverse `window.opener` handle to the viewer tab).
- **Best-effort, non-blocking, self-hiding-friendly.** The affordance adds no DOM churn to the match; a click failure shows a brief message and clears; it never covers the endgame summary or a modal (mirror the `DiagnosticExportButton` unobtrusive posture).
- **No session token in the URL.** Only the `?lagn=` payload (the loadout, non-secret — both players already see the board) goes in the opened URL; the Hanko bearer stays in the `Authorization` header of the fetch, never in the viewer link.

**Session protocol:**
- If the `authToken` accessor, the `?lagn=` encoding, or the endpoint shape is unclear, stop and read `loadoutLibraryApi.ts` / WP-362 §Contract / WP-361 §Contract — do not invent the token source or the encoding.

**Locked contract values:**
- **Endpoint:** `GET /api/match/:matchId/lagn` (WP-361), Bearer-authenticated, `{ lagn }` on 200.
- **Viewer link:** `${viewerBaseUrl}/?lagn=<base64url(UTF-8 JSON.stringify(lagn))>` (D-24154).
- **Viewer origin (`viewerBaseUrl`):** the deployed Registry Viewer origin — **confirm the live origin at execution** (`https://cards.barefootbetters.com` today per `apps/registry-viewer/CLAUDE.md`; both `cards.barefootbetters.com` and `cards.legendary-arena.com` are CORS-allowlisted server-side, but this link opens the viewer directly so it must match the served origin). A single module constant with a `// why:` — no new env var.
- **matchId source:** `new URLSearchParams(window.location.search).get('match')`.

---

## Debuggability & Diagnostics

The click flow is three observable steps: read `matchId` (absent → the control is inert / hidden), fetch (`{ ok, status }` — a non-200 maps to a named inline message: not-signed-in `401`, not-a-participant `403`, unknown `404`, network `0`), encode + open. The pure encoder is unit-tested for a byte-exact round-trip against WP-362's decoder. The fetch wrapper is unit-tested with a stubbed `fetch` (success + each failure branch, keyed on the response). No mutation of match state; the affordance is inert with respect to the game.

---

## Scope (In)

### A) `lib/lagnShareLink.ts` (new) — pure encoder
- `encodeLagnToViewerUrl(lagn, viewerBaseUrl): string` — `JSON.stringify(lagn)` → UTF-8 bytes → `btoa` → base64url (`+`→`-`, `/`→`_`, strip trailing `=`) → `${viewerBaseUrl}/?lagn=<b64url>`. Pure, deterministic, no DOM/network. Add `// why:` — this is the exact inverse of WP-362's decoder (D-24154); a round-trip test guards the contract.
- `REGISTRY_VIEWER_ORIGIN` — a module constant with a `// why:` naming the deployed viewer origin (confirm at execution per the locked value above).

### B) `lib/api/matchLagnApi.ts` (new) — authenticated fetch wrapper
- `fetchMatchLagn(matchId, authToken): Promise<MatchLagnResult>` where `MatchLagnResult = { ok: true; lagn: unknown } | { ok: false; status: number }`:
  - `GET buildApiUrl(\`/api/match/${encodeURIComponent(matchId)}/lagn\`)` with `headers: authToken === null ? {} : { Authorization: \`Bearer ${authToken}\` }`.
  - Non-200 → `{ ok:false, status }`; a thrown fetch → `{ ok:false, status: 0 }` (mirror `loadoutLibraryApi`, `// why:` on the status-0 mapping). Returns the `lagn` opaquely (`unknown`); no client-side LAGN validation.

### C) `components/ViewLoadoutButton.vue` (new) — fixed-position play-surface control
- `defineComponent({ setup() { return {...} } })` (D-6512). A small fixed-position button "View loadout in Registry Viewer" + an inline status message ref.
- `onViewLoadout()`: read `matchId` from `?match=` (absent → no-op / control hidden); read the current `authToken`; `await fetchMatchLagn(matchId, authToken)`; `ok` → `window.open(encodeLagnToViewerUrl(lagn, REGISTRY_VIEWER_ORIGIN), '_blank', 'noopener')`; `!ok` → set a full-sentence inline message keyed on `status` (`401` "Sign in to view this game's loadout." / `403` "Only players in this game can open its loadout." / `404` "This game's loadout isn't available yet." / else "The loadout couldn't be loaded — please try again."). Best-effort; never throws.
- Placement idiom + scoped `position: fixed` CSS mirror `DiagnosticExportButton.vue` (a distinct corner so the two don't overlap).

### D) `pages/PlayViewport.vue` (modified) — mount once
- Register + mount `<ViewLoadoutButton />` once at the shared viewport root, beside `<DiagnosticExportButton />`, with a `// why:` mount comment mirroring the existing sibling (covers both `PlayMobile` and `PlayDesktop`).

### E) Tests
- `lib/lagnShareLink.test.ts` — `encodeLagnToViewerUrl` produces `${base}/?lagn=…`; the payload base64url-decodes back to the original JSON (round-trip, incl. a UTF-8 card name); the encoding is the inverse of WP-362's `parseLagnUrlParam` (import it and assert `decode(encode(lagn)) === lagn`).
- `lib/api/matchLagnApi.test.ts` — stubbed `fetch`: 200 → `{ ok:true, lagn }`; 401/403/404 → `{ ok:false, status }`; a thrown fetch → `{ ok:false, status: 0 }`; the request carries `Authorization: Bearer` when a token is supplied and omits it when null (branch on the stub's received init).
- `components/ViewLoadoutButton.test.ts` — renders the control; a stubbed `ok` fetch calls `window.open` with a `?lagn=` URL + `noopener`; a `403` sets the participant message and does not open a tab (mirror `Header.test.ts` mount idiom).

---

## Out of Scope

- **No server or viewer changes** — the endpoint is WP-361, the `?lagn=` ingest is WP-362. This packet consumes both.
- **No client-side LAGN validation** — the `lagn` is opaque (`unknown`); WP-361 already `validate()`d it server-side (the "opaque `lagn`, server is authority" posture, D-24085/WP-301).
- **No creator-only sessionStorage path** — the loadout always comes from WP-361 (works for every participant, survives reload/session-clear), not from `matchSetupSession.ts`.
- **No "copy match link" / invite affordance** — that is the WP-358/360 match-invite arc, unrelated.
- **No engine / `G` / `boardgame.io` / registry import; no bgio credentials in the link.**
- Refactors to `DiagnosticExportButton`, `PlayViewport`, or the api base beyond the one mount + the new files.

---

## Files Expected to Change

- `apps/arena-client/src/lib/lagnShareLink.ts` — **new** — pure `encodeLagnToViewerUrl` + `REGISTRY_VIEWER_ORIGIN`
- `apps/arena-client/src/lib/api/matchLagnApi.ts` — **new** — `fetchMatchLagn(matchId, authToken)` (never-throws)
- `apps/arena-client/src/components/ViewLoadoutButton.vue` — **new** — fixed-position play-surface control
- `apps/arena-client/src/lib/lagnShareLink.test.ts` — **new** — `node:test` round-trip coverage
- `apps/arena-client/src/lib/api/matchLagnApi.test.ts` — **new** — `node:test` fetch-branch coverage
- `apps/arena-client/src/components/ViewLoadoutButton.test.ts` — **new** — `node:test` render/click coverage
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount `<ViewLoadoutButton />` once beside `DiagnosticExportButton`
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24155**) + `STATUS.md` + `wiki/lagn-v1.md`. `EC_INDEX.md` + EC-393 at execution-prep.

**~3 new code + 3 tests + 1 mount. Standard two-session lane.**

No other files may be modified.

---

## Contract

### Flow
in-match click → read `?match=` → `GET /api/match/:matchId/lagn` (Bearer) → `encodeLagnToViewerUrl(lagn)` → `window.open('${viewer}/?lagn=…', '_blank', 'noopener')`. Failure → full-sentence inline message; never throws, never blocks the match.

### Locked Values
| Key | Value |
|---|---|
| Source | `GET /api/match/:matchId/lagn` (WP-361), `Authorization: Bearer` |
| Encoding | base64url(UTF-8 `JSON.stringify(lagn)`) — exact inverse of WP-362 decoder (D-24154) |
| Link | `${REGISTRY_VIEWER_ORIGIN}/?lagn=<b64url>`; `window.open(..., '_blank', 'noopener')` |
| Viewer origin | deployed viewer origin (confirm at execution; `cards.barefootbetters.com` today); module constant, no new env var |
| matchId | `?match=` via `URLSearchParams` |
| Failure map | `401`→sign-in, `403`→participants-only, `404`→not-available-yet, else→try-again (full sentences) |
| Posture | opaque `lagn` (no client validation); never throws; no bearer in the URL |

---

## Acceptance Criteria

1. `encodeLagnToViewerUrl` returns `${base}/?lagn=<base64url>` whose payload decodes (via WP-362's `parseLagnUrlParam`) back to the original document byte-for-byte, incl. a UTF-8 card name (**AC-1**).
2. `fetchMatchLagn` GETs `/api/match/:matchId/lagn` with `Authorization: Bearer` when a token is supplied (omitted when null), returns `{ ok:true, lagn }` on 200, `{ ok:false, status }` on 401/403/404, and `{ ok:false, status:0 }` on a thrown fetch; never throws (**AC-2**).
3. `ViewLoadoutButton` on a successful fetch calls `window.open` with a `?lagn=` URL and `noopener`; on `403` shows the participants-only message and opens no tab; reads `matchId` from `?match=` (**AC-3**).
4. The control is mounted exactly once in `PlayViewport.vue` beside `DiagnosticExportButton` (confirmed with `Select-String`) and covers both play surfaces (**AC-4**).
5. No `boardgame.io` / `@legendary-arena/game-engine` / `@legendary-arena/registry` import in any new file; no bgio credentials or bearer token appear in the opened URL (confirmed with `Select-String` + the round-trip test) (**AC-5**).
6. `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0; `pnpm --filter @legendary-arena/arena-client test` green (new suites pass; prior count + new tests); `pnpm -r build` 0 (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/arena-client typecheck   # 0 (vue-tsc)
pnpm --filter @legendary-arena/arena-client test        # lagnShareLink + matchLagnApi + ViewLoadoutButton suites green
Select-String -Path "apps\arena-client\src\lib\lagnShareLink.ts","apps\arena-client\src\lib\api\matchLagnApi.ts","apps\arena-client\src\components\ViewLoadoutButton.vue" -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"   # no output
Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "ViewLoadoutButton"   # mounted once
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `lagnShareLink.ts` — pure encoder, inverse of WP-362 (round-trip test); `REGISTRY_VIEWER_ORIGIN` confirmed against the live viewer origin
- [ ] `matchLagnApi.ts` — Bearer GET, never-throws `{ ok, status }` (all branches tested)
- [ ] `ViewLoadoutButton.vue` — fixed-position control, `window.open(..., 'noopener')`, full-sentence failure messages; mounted once in `PlayViewport.vue`
- [ ] No engine/bgio/registry import; no bearer/credentials in the opened URL
- [ ] `pnpm -r build` 0; arena-client typecheck 0; arena-client test green
- [ ] `DECISIONS.md` **D-24155** landed; `WORK_INDEX` (WP-363) + `STATUS.md` + `wiki/lagn-v1.md` updated
- [ ] **User-visible verification (D-24026):** APPLIES. In a real match on play.legendary-arena.com, click "View loadout in Registry Viewer" → a new tab opens the viewer Loadout tab pre-filled with this game's composition; from a non-participant/spectator context the control shows the participants-only message. Screenshot the opened viewer tab. Operator-pending on deploy (requires WP-361 + WP-362 live).

---

## Vision Alignment

**Vision clauses touched:** §3 (participant identity — only a signed-in participant can open the loadout), §10a (Registry Viewer cross-surface link). **Conflict assertion:** No conflict — a read-only convenience linking two existing surfaces; no game state, scoring, or data model changes. **Non-Goal check (user-facing surface):** none of NG-1..7 crossed — opening a loadout in the viewer confers no gameplay advantage (both players already see the board) and gates nothing behind payment. §23(b): the copy is "view loadout", no match/opponent/win framing. **Determinism:** N/A — a client-side fetch + URL open; no engine, `G`, RNG, scoring, or replay.

## Funding Surface Gate

**N/A** — this WP adds an in-match link to the Registry Viewer; it introduces no global-nav / registry-viewer / profile funding affordance, no donate/support copy, and no funding-channel integration (§20.1 surfaces absent).

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (encoder + fetch wrapper + SFC + mount); §7 no new dependency (browser `btoa`/`window.open`, explicit); §8 frontend boundary (client stays opaque over `lagn`; no engine/registry import; the fetch uses the existing `buildApiUrl`+Bearer path, not an independent server URL); §11 the consumed endpoint is `authenticated-session-required` (WP-361) — this client sends the existing Hanko bearer, adds no new identity model; §12 tests present (`node:test`, stubbed `fetch`/`window.open`, no live network/DB); §15.1 surface = `play.legendary-arena.com` → DoD has the in-match live check; §17 §3/§10a/§23(b) addressed, determinism N/A; §20 N/A-with-reason; §21 N/A (consumes WP-361's endpoint; adds/modifies no `apps/server` endpoint or library fn). §18 greps target identifiers + a no-engine/no-bearer-in-URL absence check, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): BLOCKED on WP-361 + WP-362.** Both must be live (the endpoint + the ingest/encoding contract). Otherwise scope is locked to ~3 code + 3 tests + one mount, single app; no other blocker.

**Copilot (01.7): PASS (on unblock).** Failure modes pinned: (a) encoding drift from WP-362 → **round-trip test importing WP-362's decoder**; (b) leaking the bearer in the opened URL → **bearer stays in the `Authorization` header; only `?lagn=` in the URL**; (c) a fetch throw breaking the match view → **never-throws `{ ok, status }` + inline message**; (d) reverse-tabnabbing via `window.opener` → **`noopener`**; (e) a wrong/stale viewer origin producing a dead link → **locked `REGISTRY_VIEWER_ORIGIN` constant, confirm live origin at execution**; (f) client validating LAGN and drifting from the server → **opaque `lagn`, server is authority**. No BLOCK beyond the two hard-deps.

## Decision (reserved, lands at execution)

Reserves **D-24155**: the in-match "View loadout in Registry Viewer" link. Locks: (1) a fixed-position play-surface control (mounted once in `PlayViewport.vue` beside `DiagnosticExportButton`, WP-228 idiom) that fetches the current match's Tier-1 LAGN from **WP-361** `GET /api/match/:matchId/lagn` with the player's existing Hanko **bearer**, then opens **WP-362**'s `?lagn=` deep-link (`window.open(..., '_blank', 'noopener')`); (2) the client-side encoder is the **exact inverse of WP-362's decoder** (base64url of UTF-8 `JSON.stringify(lagn)`, D-24154) — guarded by a round-trip test; (3) the `lagn` is treated **opaquely** (no client-side validation — WP-361 is the authority); (4) **never-throws** fetch + full-sentence inline failure messages (`401`/`403`/`404`/network), non-blocking; (5) **no bearer/credentials in the opened URL** (only the non-secret loadout payload); (6) the viewer origin is a locked module constant confirmed against the deployed origin at execution (no new env var). Depends on WP-361 + WP-362. Drafted 2026-07-11; not yet landed.
