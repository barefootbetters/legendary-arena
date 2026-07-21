# WP-410 — Card-Image Working-Set Prefetch at Match Start (Game Engine + App)

**Layer:** Game Engine (`packages/game-engine` — projects the manifest) → App (`apps/arena-client` — prefetches it)
**EC:** `docs/ai/execution-checklists/EC-445-card-image-setup-prefetch.checklist.md`
**Reserves:** D-24222
**Baseline:** drafted off `origin/main` @ `879fa78a`
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 live verification REQUIRED**

---

## Goal

At match start, the arena client **prefetches every card image the match can show** —
warming them into the browser cache during the setup/pre-match screen — so a card
paints instantly the moment it is revealed, never blocking a turn on a round-trip to
`images.legendary-arena.com`. Because the client is forbidden from importing the
registry at runtime (layer boundary) and therefore cannot derive the image set
itself, the engine — which already computes every match card's image URL in
`G.cardDisplayData` at setup — projects the deduped set as a new optional
`UIState.matchCardImageUrls`; a new client composable warms that list with bounded
concurrency, fail-soft and idempotent. This is the setup-prefetch design the ewiki
[LAGN discussion](https://ewiki.legendary-arena.com/lagn-v1/) recommended (over
embedding image bytes or a zip side-cart), applied to the live client.

---

## Assumes

- **WP-111 ✅** — `G.cardDisplayData` (a `Record<CardExtId, UICardDisplay>` with a
  per-card `imageUrl`) is built at setup for every match card and is the sole
  in-`G` source of card image URLs. Source: `packages/game-engine/src/setup/buildCardDisplayData.ts`.
- **UIState projection ✅** — `packages/game-engine/src/ui/uiState.build.ts` builds
  the read-only `UIState` from `G`; the arena-client store
  `apps/arena-client/src/stores/uiState.ts` holds it and imports the `UIState` type
  from `@legendary-arena/game-engine`, so a new optional field's *type* flows to the
  client with no client-side type fork.
- **The audience filter is the sole engine→client boundary ✅** —
  `game.ts` registers `buildPlayerView` (→ `filterUIStateForAudience`) as
  `LegendaryGame.playerView`, "the sole engine→client projection boundary"
  (`game.ts` ~L322). `filterUIStateForAudience` (`packages/game-engine/src/ui/uiState.filter.ts`)
  **reconstructs `UIState` from an explicit field whitelist** — any top-level field
  it does not copy is silently dropped before it reaches the client. So the new
  field's *value* only reaches the client if the filter passes it through; the type
  flowing through is not enough. This is why `uiState.filter.ts` is in scope.
- **`PlayViewport.vue` ✅** — the shared viewport root that mounts once per match and
  holds `matchId` (D-16501); it is the correct single place to mount the prefetch
  composable. Source: `apps/arena-client/src/pages/PlayViewport.vue`.
- **Layer boundary ✅** — `apps/arena-client` MUST NOT import `@legendary-arena/registry`
  at runtime (`.claude/rules/architecture.md` Import Rules). The client therefore
  cannot construct image URLs; it may only consume URLs the engine already resolved.
- **R2 image delivery ✅** — card images are immutable `.webp` on
  `images.legendary-arena.com` (Cloudflare R2 + CDN) serving
  `Access-Control-Allow-Origin: *`; warming them needs no auth and no CORS change
  (`wiki/data-file-locations.md`, `packages/registry/src/heroImageUrl.ts`).

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — the Engine→App
  dependency direction this WP follows, and the arena-client "no runtime registry
  import" rule that forces the manifest to originate in the engine.
- `.claude/rules/architecture.md` §Import Rules — arena-client's forbidden imports.
- `packages/game-engine/src/ui/uiState.types.ts` — the `UIState` and `UICardDisplay`
  interfaces this WP extends with one optional field.
- `packages/game-engine/src/ui/uiState.build.ts` + `.../uiState.build.test.ts` — where
  the manifest is populated and asserted.
- `packages/game-engine/src/ui/uiState.filter.ts` — `filterUIStateForAudience`, the
  whitelist that reconstructs `UIState` at the engine→client boundary; the new field
  must be added to its reconstruction (public, identical for every audience) or it is
  dropped.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the type-drift pins.
  Note: there is **no** exhaustive top-level `UIState` keyset assertion here (its
  `Object.keys(...).sort()` checks pin *sub-shapes* like `UIState['game']`). New
  top-level `UIState` fields are pinned with a `Pick<UIState, 'field'> satisfies`
  drift check — the `pendingKoHeroChoice` / `notableEvents` precedent — which is the
  additive assertion this WP adds.
- `apps/arena-client/src/pages/PlayViewport.vue` + `apps/arena-client/src/components/play/CardTile.vue`
  — the mount root and the `<img :src="display.imageUrl" loading="lazy">` render
  surface whose mid-turn pop-in this WP eliminates.
- `docs/ai/DECISIONS.md` — scan for the UIState-projection precedents (D-24081
  observability-only exclusion; D-16501 matchId prop-drill) and reserve **D-24222**.
- `wiki/lagn-v1.md` §"Card Images: Embed, Side-Cart, or Prefetch?" — the design
  analysis this WP implements (Option C).

---

## Scope (In)

1. **Engine — project the manifest.** Add an optional top-level field
   `matchCardImageUrls?: string[]` to `UIState` (`uiState.types.ts`), and populate it
   in `uiState.build.ts` as the **deduped list of every non-empty `imageUrl` across
   `G.cardDisplayData`** — the complete set of card-face images the match can show.
   `uiState.build.ts` ALWAYS sets the field (an empty match yields `[]`); the type is
   optional only so pre-existing hand-written `UIState` fixtures do not need a
   backfill (the WP-179 optional-field pattern).
2. **Engine — pass the manifest through the audience filter.** Add
   `matchCardImageUrls` to `filterUIStateForAudience`'s reconstruction in
   `uiState.filter.ts`, copied **public and value-identical for every audience**
   (player and spectator) — it is information-safe, like the `notableEvents` /
   `progress` public pass-throughs — with an aliasing-safe copy (`[...uiState.matchCardImageUrls]`)
   and conditional assignment (never a literal `undefined`, for
   `exactOptionalPropertyTypes`). Without this the field is dropped at the sole
   engine→client boundary and the feature is dead-on-arrival.
3. **Engine — tests.** `uiState.build.test.ts` asserts the field equals the deduped
   non-empty `imageUrl` set of `cardDisplayData` (order-independent; empties excluded;
   no duplicates). `uiState.filter.test.ts` asserts the field **survives**
   `filterUIStateForAudience` for both a player and a spectator audience, value-equal.
   `uiState.types.drift.test.ts` adds an **additive** `Pick<UIState, 'matchCardImageUrls'> satisfies`
   drift pin (the `pendingKoHeroChoice` / `notableEvents` precedent) — NOT an
   exhaustive top-level keyset (none exists).
4. **Client — prefetch composable.** A new `useCardImagePrefetch.ts` that, when
   `UIState.matchCardImageUrls` first becomes non-empty for a match, warms each URL
   into the browser cache with **bounded concurrency** (`PREFETCH_CONCURRENCY = 6`),
   **fail-soft** (a rejected fetch is skipped, never thrown, never blocks), and
   **idempotent** (a `Set` of already-warmed URLs means a re-render/reconnect does not
   refetch). Warming uses the browser `fetch`/`Image` surface only.
5. **Client — wiring + tests.** Mount the composable once in `PlayViewport.vue`
   (`01.5` runtime-wiring, the D-16501 match root); `useCardImagePrefetch.test.ts`
   covers the fetch-once, fail-soft, and idempotent behaviors against a mocked
   fetch/Image. The composable MUST be a **no-op when the manifest is absent or empty**
   so the existing `PlayViewport.test.ts` (which mounts the root with a null snapshot
   under jsdom) stays green without editing it — do not touch `fetch`/`new Image()` at
   mount, only when a non-empty `matchCardImageUrls` first arrives. Add
   `PlayViewport.test.ts` to scope only if that no-op observation fails.
6. **Governance:** D-24222 Active; `STATUS.md`; both indices; mindmap; and the
   D-24026 live-verify STATUS flip after deploy.

## Out of Scope

- **Any LAGN format change** — no image bytes and no manifest block in the LAGN
  document; the ewiki discussion rejected embed/zip, and the prefetch is a live-client
  delivery concern, not a notation concern (D-24222).
- **A service worker / Cache Storage API** — v1 warms the volatile HTTP cache only.
  Durable cross-reload/cross-match caching via a service worker is a **named future
  follow-on**, not this WP (it introduces PWA registration + lifecycle concerns).
- **First-visible priority ordering** — v1 warms the whole manifest in one bounded
  pass; ordering the opening hand / HQ / mastermind first is a future refinement.
- **The R2 immutable `Cache-Control` header change** — an ops/CDN config change
  (bucket metadata), not a repo change; it is the recommended companion that makes
  warmed bytes free across matches, but it is out of this WP's tree.
- **Any `apps/server` / HTTP-endpoint change** — the manifest rides the existing
  UIState transport; no new endpoint (§21 N/A).
- **Any `G` mutation, RNG, scoring, or persistence surface** — the manifest is a
  projection derived from `G.cardDisplayData`, never added to `G`.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add optional `matchCardImageUrls?: string[]` to `UIState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate `matchCardImageUrls` (deduped, non-empty `imageUrl`s from `G.cardDisplayData`)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass `matchCardImageUrls` through `filterUIStateForAudience` (public, value-identical for every audience; aliasing-safe copy)
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — manifest content assertions (deduped, non-empty, order-independent)
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — assert the field survives filtering for a player and a spectator audience
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — add an additive `Pick<UIState, 'matchCardImageUrls'> satisfies` drift pin (the `pendingKoHeroChoice` precedent; no exhaustive top-level keyset exists)
- `apps/arena-client/src/composables/useCardImagePrefetch.ts` — **new** — bounded-concurrency, fail-soft, idempotent prefetch pass
- `apps/arena-client/src/composables/useCardImagePrefetch.test.ts` — **new** — fetch-once / fail-soft / idempotent tests
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount the composable once at the match root (`01.5` runtime-wiring)
- `docs/ai/DECISIONS.md` — **modified** — D-24222 Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified file — no diffs, no snippets, no
  "show only the changed section."
- ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
  (full English names, functions ≤30 lines w/ JSDoc, `// why:` on non-obvious code,
  no premature abstraction, full-sentence error messages).
- No `Math.random()`, wall-clock reads, or I/O inside engine projection code.

**Packet-specific:**
- **Engine→App direction only.** The engine PRODUCES `matchCardImageUrls`; the client
  CONSUMES it. The client constructs no image URL and adds **no** `@legendary-arena/registry`
  import (layer boundary).
- **Projection-only, no `G` field.** `matchCardImageUrls` is derived from
  `G.cardDisplayData` at projection time; it is NOT written to `G` and does not touch
  the state-hash surface (`computeStateHash` hashes `G`, not `UIState`; no sentinel
  re-pin).
- **Optional field.** `matchCardImageUrls?` is optional in the type so existing
  `UIState` fixtures need no backfill; `uiState.build.ts` nonetheless always populates
  it (empty `[]` for an empty match).
- **Information-safe.** The manifest is a flat, deduped set of card-face image URLs.
  Which card *designs* a match contains is public from the composition; the manifest
  reveals no face-down deck order and no per-player hidden state.
- **Prefetch never blocks or throws.** The composable is fire-and-forget, fail-soft,
  and idempotent; a failed image is skipped and covered by the existing
  `<img loading="lazy">` fallback in `CardTile.vue`.
- No new npm dependency; browser `fetch`/`Image` only (no `axios`/`node-fetch`).

**Session protocol:** stop and ask on any unclear item; do not invent a second
manifest source, a `G` field, or a service worker.

**Locked contract values:**
- Field: `UIState.matchCardImageUrls?: string[]` (optional; always populated by build; deduped; non-empty entries only).
- `PREFETCH_CONCURRENCY = 6` (bounded in-flight requests).

---

## Contract

Read-only UIState projection extension (one optional field) consumed by a client
composable. No HTTP surface changes — the manifest rides the existing boardgame.io
`playerView` transport. It is **static for a match** but re-sent on each state frame
(boardgame.io ships the full filtered `playerView` per update by default; it is not
JSON-patch-diffed on the WP-090 transport). The payload is small (a deduped list of
~70–100 short URL strings, a few KB) and immutable, so the client warms it once and
ignores it on every later frame — a negligible per-frame cost against the images it
saves. §21 N/A (no `apps/server` endpoint added or changed). The field is additive and
optional; every 1.x UIState consumer that ignores it is unaffected.

---

## Acceptance Criteria

- **AC-1** — `UIState.matchCardImageUrls` is present after setup and equals the
  **deduped, non-empty** set of `imageUrl` values across `G.cardDisplayData`
  (asserted order-independent in `uiState.build.test.ts`; a card with an empty
  `imageUrl` contributes nothing; no URL appears twice).
- **AC-2** — The field **reaches the client through the audience filter**:
  `uiState.filter.test.ts` asserts `filterUIStateForAudience` returns
  `matchCardImageUrls` **value-equal** to the input for both a player and a spectator
  audience (the engine→client delivery guarantee; without the pass-through the field
  is dropped and every other AC could pass with the feature dead).
- **AC-3** — The field is **optional** in `uiState.types.ts` so pre-existing
  hand-written `UIState` fixtures still typecheck (no REQUIRED-field backfill across
  engine/arena-client), and `uiState.types.drift.test.ts` gains an **additive**
  `Pick<UIState, 'matchCardImageUrls'> satisfies` drift pin (the `pendingKoHeroChoice`
  precedent) — there is no exhaustive top-level keyset to extend.
- **AC-4** — No `G` field is added; `pnpm --filter @legendary-arena/game-engine test`
  shows every recorded sentinel `finalStateHash` and `PRE_WP080_HASH` **byte-unchanged**
  (projection-only; no re-pin).
- **AC-5** — On the first UIState update whose `matchCardImageUrls` is non-empty,
  `useCardImagePrefetch` issues **exactly one** warm per distinct URL, with **at most
  `PREFETCH_CONCURRENCY` in flight** (asserted against a mocked fetch/Image in
  `useCardImagePrefetch.test.ts`).
- **AC-6** — A rejected warm does **not** throw, does **not** block, and does **not**
  abort the remaining warms (asserted with a mock that rejects one URL; the others
  still complete).
- **AC-7** — A second UIState update carrying the same manifest triggers **no**
  additional warms for already-warmed URLs (idempotency; the warm count does not grow).
  A mount with an absent/empty manifest triggers **zero** warms (the `PlayViewport.test.ts`
  no-op guarantee).
- **AC-8** — `apps/arena-client` adds **no** `@legendary-arena/registry` import and
  constructs **no** image URL: a grep for `@legendary-arena/registry` and for
  `images.legendary-arena.com` under `apps/arena-client/src/composables/useCardImagePrefetch.ts`
  returns zero — every URL originates from `matchCardImageUrls`.
- **AC-9** — `pnpm --filter @legendary-arena/game-engine build` 0;
  `pnpm --filter arena-client typecheck` 0; `pnpm --filter arena-client test` 0;
  `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures.
- **AC-10** — **D-24026 live verification** on `play.legendary-arena.com`: in a real
  match, the browser network panel shows the working-set images fetched during the
  setup/pre-match screen, and a card **revealed later paints from cache** (no image
  request at reveal time). Drive the terminal action — observe an actual reveal, not
  just the setup burst.

---

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build   # expect exit 0
pnpm --filter @legendary-arena/game-engine test     # expect 0 failures; sentinel hashes unchanged
pnpm --filter arena-client typecheck                # expect exit 0 (vue-tsc — the load-bearing SFC gate)
pnpm --filter arena-client test                     # expect 0 failures
pnpm -r build                                        # expect exit 0
pnpm -r --no-bail test                               # expect no new failures
pnpm roadmap:counts:check                            # expect exit 0 (node present, counts current)
# AC-8 layer gate — both expect zero matches:
grep -R "@legendary-arena/registry" apps/arena-client/src/composables/useCardImagePrefetch.ts
grep -R "images.legendary-arena.com" apps/arena-client/src/composables/useCardImagePrefetch.ts
```

Then the AC-10 live pass on the deployed bundle: open a real match, watch the network
panel warm the working set during setup, then confirm a later-revealed card paints
with no network request.

---

## Vision Alignment

- **Clauses touched:** §1 (the play experience), §2 (faithful card presentation),
  §10 (card imagery), NG-1 (no pay-to-win).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` Prefetch
  is a delivery/performance optimization — it changes no card content, image, or
  semantics (§2 unchanged: identical images, merely earlier), and it is not a paid or
  persuasive surface.
- **Non-Goal proximity (NG-1):** the prefetch confers **no gameplay capability or
  advantage** — every client warms the same public card-image set; nothing about
  outcomes, information, or timing of legal moves changes. NG-1..7 uncrossed.
- **Determinism preservation:** `matchCardImageUrls` is derived **deterministically**
  from `G.cardDisplayData` with no RNG and no `G` mutation; it is a projection, so the
  replay/state-hash surface (Vision §22) is untouched — every sentinel hash is
  byte-unchanged (AC-4).

## Funding Surface Gate

**N/A** — this WP touches no funding affordance: no global-nav or registry-viewer
funding surface, no profile funding attribution, no tournament funding channel, and no
user-visible "donate/support" copy. It is a client image-prefetch optimization.

## Lint Gate Self-Review (`00.3`)

§1 Structure **PASS** (all required sections present) · §2 Constraints **PASS**
(full-file, ESM/Node v22, cites 00.6) · §3 Assumes **PASS** (cardDisplayData,
UIState transport, PlayViewport, layer boundary, R2 all listed) · §4 Context **PASS**
(specific docs + sections; ARCHITECTURE + rules cited for the layer crossing) ·
§5 Files **PASS** (9 code/test files = 5 impl + 4 paired tests, one coherent additive
feature; pre-flight RS-2 confirmed single-WP over a split; each marked new/modified) · §6 Naming
**PASS** (`matchCardImageUrls`, `imageUrl`, `cardDisplayData`, `ext_id` per 00.2/prior)
· §7 Deps **PASS** (no new dep; browser `fetch`/`Image`; axios/node-fetch rejected) ·
§8 Boundaries **PASS** (Engine→App direction; no runtime registry import; no `G`
write) · §9 Windows N/A (no shell script) · §10 Env N/A (no new env var) · §11 Auth
**N/A** (no auth surface) · §12 Tests **PASS** (`node:test`; client composable tests
network-mocked, no live network/DB) · §13 Verification **PASS** (exact pnpm + grep
gates w/ expected output) · §14 Acceptance **PASS** (10 binary, observable ACs) ·
§15 DoD **PASS** + §15.1 **TRIGGERED** (`User-Visible Surface = play.legendary-arena.com`;
AC-10 live-verifies the reveal) · §16 Code-style **PASS** (small functions, `// why:`
on the concurrency cap + optional-field choice, no premature abstraction) ·
§17 Vision **TRIGGERED** (card images; `## Vision Alignment` present w/ clause numbers
+ determinism line) · §18 Prose-vs-grep **PASS** (the AC-8 literal-scoped greps target
`useCardImagePrefetch.ts`, which carries no prose enumerating those tokens) ·
§20 Funding **N/A** (justified above — no funding surface) · §21 API Catalog **N/A**
(no `apps/server` endpoint; manifest rides the existing UIState transport). All others
PASS/N/A.

---

## Definition of Done

- [ ] AC-1..AC-10 each demonstrated; AC-10 live-verified on the deployed `play.legendary-arena.com` bundle
- [ ] `pnpm --filter arena-client typecheck` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures; sentinel hashes byte-unchanged (AC-4)
- [ ] D-24222 landed **Active** (engine projects the manifest; client warms it; projection-only, information-safe, LAGN unchanged)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `git diff --name-only` matches §Files Expected to Change
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `pnpm roadmap:counts:check` exits 0
