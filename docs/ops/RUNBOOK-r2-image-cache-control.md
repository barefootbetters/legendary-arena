# Operator Runbook — `Cache-Control` on R2 Card Images and Audio

> **Scope note (2026-08-17):** this runbook began as the card-image `immutable`
> change (§1–§3) and now also covers the **audio** prefixes (§4), which take the
> *opposite* value — a short revalidatable TTL, because audio filenames are fixed and
> replaced in place. Read [§The immutable scope](#the-immutable-scope-read-before-running-anything)
> before running any command: the two cases are not interchangeable.

**Purpose:** Card images on `images.legendary-arena.com` (the Cloudflare R2
`legendary-images` bucket) are served today with **no `Cache-Control` header** and
`cf-cache-status: DYNAMIC` — the CDN is not edge-caching them, and browser reuse
falls back to heuristic `ETag`/`Last-Modified` revalidation. This runbook sets
`Cache-Control: public, max-age=31536000, immutable` on the **card-image objects**
so the CDN edge absorbs the load and a previously-seen card is free on every later
request. It is the companion **ops** change to **WP-410 / D-24222** (the match-start
card-image prefetch): the prefetch warms each image once per client, and this change
makes that warm-once cost stick **across matches** instead of re-downloading every
match.

This document is **operational, not architectural**. It is subordinate to
`docs/ai/ARCHITECTURE.md` and `.claude/rules/`. It requires **no repository code or
contract change** — card-image URLs, filenames, and the registry are untouched.
Related: [`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md),
[`DOMAINS.md`](./DOMAINS.md),
[R2 Image Naming Convention](../../wiki/r2-image-naming-convention.md),
[Data & File Locations](../../wiki/data-file-locations.md),
`docs/ai/STATUS.md` (the WP-410 AC-10 live-verify line).

---

## Why this is a runbook, not a Work Packet

WPs govern **repository code and contract changes**. This change edits **no `.ts`,
no schema, no contract** — it sets object metadata on a Cloudflare R2 bucket and,
optionally, a Cloudflare Cache Rule. That is an out-of-band operator action, the same
class as the Hanko App-URL fix and the legends env-var runbook in this directory.
Record it in [`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md) when done.

---

## TL;DR — Recommendation

1. **Set `Cache-Control` on the card-image objects only** — the per-set `.webp`
   under `{setAbbr}/`. Backfill the existing objects and amend the upload command so
   future uploads carry it (commands in [§Apply](#apply)). Target value:

   ```
   Cache-Control: public, max-age=31536000, immutable
   ```

2. **Do NOT apply `immutable` to `avatars/` or `metadata/`** (see
   [§The immutable scope](#the-immutable-scope-read-before-running-anything) — this is
   the one way to get this wrong). Those objects are **mutable at a stable key** and
   `immutable` would pin stale content.

3. **Verify** two `HEAD`s (`MISS` then `HIT`, header present) and one real match
   (WP-410 AC-10) — see [§Verify](#verify).

4. **Record** the change in `OUT-OF-BAND-SETTINGS.md` and flip the WP-410 AC-10
   line in `STATUS.md` once the live-verify passes.

**Risk: low, with one real hazard.** The change is reversible (re-set the header /
purge cache). The single hazard is scoping `immutable` onto a mutable prefix; the
guardrail below prevents it. Setting a long cache on the **content-addressed** card
images is safe because a given `{setAbbr}-{ribbon}-{slug}.webp` never changes bytes —
new art is a new slug/set, i.e. a new URL.

---

## Current state (evidence)

A live `HEAD` on a card image (re-confirmed while writing this):

```
$ curl -sI https://images.legendary-arena.com/core/core-hr-spider-man-astonishing-strength.webp
HTTP/1.1 200 OK
Content-Type: image/webp
ETag: "84e785f048d8ee1a2907bc5b5a339fa5"
cf-cache-status: DYNAMIC          <- not edge-cached
                                  <- (no Cache-Control header at all)
```

`DYNAMIC` means Cloudflare is not caching the object at the edge, because the origin
(R2) returns no cache directive. Every client fetch is a full origin round-trip;
nothing is reused across matches or across users.

## The immutable scope (read before running anything)

The `legendary-images` bucket holds several prefixes with **different mutability**.
`immutable` is correct for exactly one of them:

| Prefix | Mutability | `immutable`? |
|---|---|---|
| `{setAbbr}/{setAbbr}-{ribbon}-{slug}.webp` | **Immutable** — filename is content-addressing; new art = new slug/set = new URL | **YES** — this runbook's target |
| `avatars/{accountId}.webp` | **Mutable** — a user re-uploading their avatar overwrites the **same key** with new bytes | **NO** — `immutable` would serve the old avatar forever |
| `metadata/{abbr}.json`, `metadata/sets.json`, … | **Mutable** — re-synced by hand when card data changes | **NO** — the Registry Viewer would read stale data |
| `audio/sound-effects/…`, `audio/music/…` | **Mutable** — fixed filenames (`play-card.mp3`, `menace-calm.mp3`) replaced in place when a clip is re-cut | **NO** — see §4; they need a *short revalidatable* TTL, not `immutable` |
| `themes/…`, `legends/…` | Out of scope here (own delivery story) | — leave as-is |

Every command below is **scoped to the per-set card-image prefixes** and explicitly
excludes `avatars/`, `metadata/`, `audio/`, `themes/`, `legends/`. Do not run an
unscoped, whole-bucket metadata rewrite.

> **Note:** avatars and metadata still deserve a *revalidatable* cache
> (e.g. `public, max-age=300, must-revalidate`) rather than nothing — but that is a
> **separate, out-of-scope** decision. Steps 1–3 only make the safe, high-leverage
> card-image change. Do not fold the mutable prefixes into them.
>
> The **audio** prefixes are the one mutable case now handled here, in **§4** — added
> 2026-08-17 after a replaced music loop served stale to every listener. Its command
> is separately scoped and uses a short revalidatable TTL, never `immutable`. Avatars
> and `metadata/` remain open and would follow the same §4 shape.

## Apply

R2 is S3-compatible; the repo already carries R2 credentials in the local `.env`
(`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) and as `R2_*` on Render. Setting a
response `Cache-Control` on the **R2 object** is the single source of truth — the
Cloudflare edge and the browser both honor it, so no separate rule is strictly
required.

### 1. Backfill existing card images (one-time)

Set the header in place on the already-uploaded objects. An S3 copy-onto-self with
`--metadata-directive REPLACE` updates metadata without re-uploading bytes. Run per
set prefix (safe, resumable) or over the bucket with explicit excludes. Using the AWS
CLI against the R2 S3 endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`):

```bash
# why: --metadata-directive REPLACE rewrites object metadata in place; the
# --content-type is re-stated because REPLACE drops any header not restated.
# EXCLUDES the mutable prefixes — do not remove these excludes.
aws s3 cp s3://legendary-images/ s3://legendary-images/ \
  --recursive \
  --endpoint-url "https://<ACCOUNT_ID>.r2.cloudflarestorage.com" \
  --exclude "avatars/*" --exclude "metadata/*" \
  --exclude "audio/*" --exclude "themes/*" --exclude "legends/*" \
  --metadata-directive REPLACE \
  --content-type "image/webp" \
  --cache-control "public, max-age=31536000, immutable"
```

Prefer a **dry run first** (`--dryrun`) and confirm the object list contains only
`{setAbbr}/…webp` and none of the excluded prefixes.

**rclone alternative** (matches the existing upload tooling — same remote as
[Card Image Acquisition](../../wiki/card-image-acquisition.md)): re-copy the local
upload-ready tree with the header. Because the bytes are content-identical, this is
idempotent per set:

```bash
rclone copy renamed\<set> r2:legendary-images/<set>/ --s3-no-check-bucket \
  --header-upload "Cache-Control: public, max-age=31536000, immutable"
```

### 2. Make future uploads carry it (durable fix)

Amend the documented card-image upload command so **every new set** ships the header
without a follow-up backfill. This runbook updates the command in
[Card Image Acquisition](../../wiki/card-image-acquisition.md) to:

```bash
rclone copy renamed\<set> r2:legendary-images/<set>/ --s3-no-check-bucket \
  --header-upload "Cache-Control: public, max-age=31536000, immutable"
```

### 3. Edge Cache Rule — REQUIRED (the object header alone is not enough)

**Confirmed 2026-07-21:** after the object backfill (step 1), a live `HEAD` still returns
`cf-cache-status: DYNAMIC` — the object `Cache-Control` fixes *browser* caching but the
Cloudflare **edge** does not cache the R2 custom-domain responses without an explicit
Cache Rule. So this step is required to get edge caching (lower R2 egress + faster first
paint for new clients); until it lands, only browser caching is active.

Create the rule on the **`legendary-arena.com`** zone (account
`a1e9255402b3d778a06b56fda38eee85`; `images.legendary-arena.com` is an R2 custom domain
on that zone).

**Matcher — scopes to card images, excludes avatars (also `.webp` on the same host):**

```
(http.host eq "images.legendary-arena.com" and ends_with(http.request.uri.path, ".webp") and not starts_with(http.request.uri.path, "/avatars/"))
```

> `.webp` already excludes `metadata/` (`.json`), `audio/` (`.mp3`), and the JSON under
> `themes/` / `legends/`; the only other `.webp` on this host is `avatars/`, which the
> `not starts_with(…"/avatars/")` clause excludes. Do **not** write a bare `.webp` rule.

#### Option A — Dashboard (copy-paste)

Cloudflare dashboard → select the **`legendary-arena.com`** zone → **Caching → Cache
Rules → Create rule**:

- **Rule name:** `Edge-cache immutable R2 card images`
- **When incoming requests match:** choose **Custom filter expression**, then **Edit
  expression** and paste the matcher above.
- **Then → Cache eligibility:** **Eligible for cache**
- **Edge TTL:** **Respect origin TTL** (honors the objects' `max-age=31536000, immutable`)
- **Browser TTL:** **Respect origin TTL**
- Deploy.

#### Option B — API (Rulesets, cache-settings phase)

Needs a token with **Zone → Cache Rules → Edit** on this zone, and the zone id
(Dashboard → the zone → **Overview → API → Zone ID**).

```sh
# why: PUT to the phase ENTRYPOINT replaces ALL rules in the cache-settings phase.
# If this zone already has cache rules, GET the entrypoint first, append this rule to
# its "rules" array, and PUT the merged set — do not blind-PUT a single rule.
curl -X PUT \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_cache_settings/entrypoint" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "rules": [
      {
        "description": "Edge-cache immutable R2 card images (exclude avatars)",
        "expression": "(http.host eq \"images.legendary-arena.com\" and ends_with(http.request.uri.path, \".webp\") and not starts_with(http.request.uri.path, \"/avatars/\"))",
        "action": "set_cache_settings",
        "action_parameters": {
          "cache": true,
          "edge_ttl": { "mode": "respect_origin" },
          "browser_ttl": { "mode": "respect_origin" }
        }
      }
    ]
  }'
```

#### Confirm it took

```sh
# why: use GET, not HEAD (-I). Cloudflare caches GET responses; a HEAD request shows
# cf-cache-status: DYNAMIC even when GETs are HIT. -o /dev/null discards the body,
# -D - dumps the response headers. Run twice: MISS (populates) then HIT.
curl -s -o /dev/null -D - https://images.legendary-arena.com/core/core-hr-spider-man-astonishing-strength.webp | grep -i cf-cache-status
curl -s -o /dev/null -D - https://images.legendary-arena.com/core/core-hr-spider-man-astonishing-strength.webp | grep -i cf-cache-status
# an avatar must stay uncached at the edge (mutable) — the rule excludes /avatars/
curl -s -o /dev/null -D - https://images.legendary-arena.com/avatars/<someAccountId>.webp | grep -i cf-cache-status
```

> **Verified applied 2026-07-21:** the rule `Edge-cache immutable R2 card images` is
> Active on the `legendary-arena.com` zone; a GET returns `cf-cache-status: HIT`.

Then flip the `Status` lines in this runbook's companion records to fully applied:
[`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md) and the WP-410 AC-10 line in
`docs/ai/STATUS.md`.

### 4. Audio prefixes — a SHORT revalidatable TTL (one-time backfill)

**Different problem, opposite answer.** Card images are content-addressed, so
`immutable` is safe. Audio clips are the reverse: `audio/sound-effects/play-card.mp3`
and `audio/music/menace-calm.mp3` are **fixed filenames whose bytes get replaced**
when a clip is re-cut. `immutable` would pin a stale clip at the edge effectively
forever. But leaving them with **no** `Cache-Control` — the state they shipped in — is
also wrong: they inherit Cloudflare's default TTL, so a replacement serves the old
audio for an unpredictable stretch with no signal that anything is wrong.

> **This is not hypothetical.** On 2026-08-17 the adaptive-music loops were replaced
> with longer 4× versions. The upload succeeded and origin held the new bytes, but
> the edge served the previous files to every listener until a manual purge. It went
> unnoticed because the check used was a **HEAD** request — see the Verify section
> below: Cloudflare answers HEAD from origin while caching GET, so HEAD reported the
> new object the whole time it was serving the old one.

The target is `public, max-age=300, must-revalidate`: a replacement lands on its own
within five minutes, and each revalidation is a cheap `304` against the object's
ETag rather than a re-download.

**New uploads already carry it.** `scripts/upload-move-sfx-to-r2.mjs` sets the header
via `--header-upload` (default `--cache-control`), and its post-upload verification
compares the **served byte length** against what was just uploaded, failing with an
explicit `STALE` diagnosis when the edge is serving a cached copy. Nothing below is
needed for anything uploaded through that script from 2026-08-17 onward.

**What needs the backfill:** objects uploaded *before* that flag existed — the whole
of `audio/sound-effects/` (WP-412 event cues, WP-413/425 combo stings, WP-421 move
SFX). `audio/music/` was already backfilled on 2026-08-17.

An in-place metadata rewrite is the right tool here — it needs **no local copy of the
audio**, which matters because those source clips are not in the repo (D-24219) and
may not exist on the operator's disk any more:

```bash
# why: --metadata-directive REPLACE rewrites metadata in place without re-uploading
# bytes; --content-type is re-stated because REPLACE drops any header not restated,
# and audio/mpeg is required for the browser to decode the clip at all.
# SCOPED to the audio prefix — do not widen this to the bucket root.
aws s3 cp s3://legendary-images/audio/sound-effects/ s3://legendary-images/audio/sound-effects/ \
  --recursive \
  --endpoint-url "https://<ACCOUNT_ID>.r2.cloudflarestorage.com" \
  --metadata-directive REPLACE \
  --content-type "audio/mpeg" \
  --cache-control "public, max-age=300, must-revalidate"
```

Dry-run first with `--dryrun` and confirm the listing contains only `*.mp3` under
`audio/sound-effects/`.

**Order matters, and it is the opposite of the intuitive one.** Rewrite the metadata
**first**, then purge. Purging first leaves a window in which the edge re-caches the
headerless object, and you are back where you started.

Then purge the affected URLs once (Caching → Configuration → Purge Cache → Custom
Purge, full `https://` URLs — a bare path silently matches nothing). This is the last
purge these objects should ever need: once the header is on them, future replacements
expire on their own.

Verify with a **GET**, never a HEAD, and check the byte length rather than just the
status:

```bash
curl -s -o /dev/null -D - https://images.legendary-arena.com/audio/sound-effects/play-card.mp3 | grep -iE 'content-length|cache-control|cf-cache-status'
# want: cache-control: public, max-age=300, must-revalidate
```

## Verify

1. **Header + edge cache** — two **GET**s on a card image (NOT `HEAD`/`-I`: Cloudflare
   caches GETs, and a HEAD shows `cf-cache-status: DYNAMIC` even when GETs are `HIT`):

   ```bash
   curl -s -o /dev/null -D - https://images.legendary-arena.com/core/core-hr-spider-man-astonishing-strength.webp | grep -iE 'cache-control|cf-cache-status'
   # first : cache-control: public, max-age=31536000, immutable
   #         cf-cache-status: MISS   (populates the edge)
   # second: cf-cache-status: HIT
   ```

2. **Mutable prefixes untouched** — confirm an avatar and a metadata JSON did **not**
   get `immutable`:

   ```bash
   curl -sI https://images.legendary-arena.com/avatars/<someAccountId>.webp | grep -i cache-control
   curl -sI https://images.legendary-arena.com/metadata/sets.json | grep -i cache-control
   # neither should read "immutable"
   ```

3. **WP-410 AC-10 (the payoff)** — in a real match on `play.legendary-arena.com`,
   confirm the working set warms at setup and, in a **second** match sharing a hero,
   that hero's images are served **from cache / 304**, not re-downloaded. This is the
   cross-match reuse this change unlocks. Flip the WP-410 AC-10 line in `STATUS.md`.

## Rollback

Fully reversible. To revert, re-run the backfill with a short revalidatable value
(e.g. `--cache-control "public, max-age=300, must-revalidate"`) or an empty string,
delete any Cache Rule added in step 3, and **purge the affected paths** from the
Cloudflare cache (dashboard → Caching → Purge, or the API by URL prefix). No object
bytes change on rollback.

## Record-keeping

- Add a line to [`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md): the header
  value, the scope (card-image prefixes only), the date, and whether a Cache Rule was
  added.
- Flip the **WP-410 AC-10** live-verify line in `docs/ai/STATUS.md` once
  [§Verify](#verify) step 3 passes.

## Why this is worth doing (business lens)

Every card image currently crosses the origin on every fetch. Edge-caching immutable
card art cuts R2 egress and origin requests to roughly **once per edge PoP per object**
instead of once per client per match — lower cloud/R2 bills and faster first paint for
players, with no product risk. It is the multiplier that makes WP-410's per-match
prefetch a per-client-lifetime cost instead of a per-match cost.
