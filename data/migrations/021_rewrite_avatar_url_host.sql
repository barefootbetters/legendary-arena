-- WP-296 / EC-328 — Avatar CDN host unification: rewrite avatar_url host
-- Created 2026-06-30 per WP-296 / EC-328 / D-24083.
--
-- One-shot, idempotent rewrite of the stored avatar CDN host on
-- legendary.player_profiles.avatar_url. Avatars move from the legacy
-- images.barefootbetters.com host to images.legendary-arena.com — the same
-- Cloudflare custom domain and the same legendary-images R2 bucket that
-- already serves card images (D-24083; supersedes the host string only in
-- D-10601 / D-10602). The avatar OBJECTS (avatars/{accountId}.webp) are not
-- moved; only the host prefix of the stored URL string changes. The new
-- domain already serves the same bucket, so existing avatars keep resolving.
--
-- Idempotent: the WHERE clause matches only rows still carrying the OLD host
-- prefix, so a second run rewrites zero rows — a clean no-op, mirroring the
-- WP-104 / WP-101 idempotent-migration precedent (004..009). NULL avatar_url
-- rows do not match the LIKE and are left untouched.

UPDATE legendary.player_profiles
   SET avatar_url = 'https://images.legendary-arena.com/avatars/'
                    || substring(avatar_url FROM (char_length('https://images.barefootbetters.com/avatars/') + 1))
 -- why: updated_at is deliberately NOT advanced. This is a system-initiated
 -- host migration, not an owner edit; every successful PATCH /api/me/profile
 -- advances updated_at to record the owner's last edit, and bumping it here
 -- would corrupt that "last edited by the owner" semantic for every profile.
 WHERE avatar_url LIKE 'https://images.barefootbetters.com/avatars/%';
