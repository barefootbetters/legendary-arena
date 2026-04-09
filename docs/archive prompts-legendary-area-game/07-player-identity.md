# Prompt 07 — Player Identity

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. No Passport/Auth0/etc.
> No database table for tokens. JWT secret from environment variable only.
> Server must exit if JWT_SECRET is missing at startup.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

## Assumes
- Prompt 06 complete: lobby routes exist and return `playerCredentials`
- No existing auth system — greenfield
- Client is Vue 3 SPA at `https://cards.barefootbetters.com`

---

## Role
Add the minimum viable player identity system to prevent one player from
calling lobby actions as another. This is not a public auth system.
Avoid over-engineering.

---

## What "Player Identity" Means Here
- Player chooses a display name when joining a lobby.
- A token is optionally issued at join time to authenticate *custom lobby endpoints*.
- No accounts, passwords, email, or persistent player profiles.

You must explicitly state what this does NOT protect against.

---

## Critical Design Decision (choose one and justify)

**Option A — Dual token:**
- boardgame.io `playerCredentials` protects moves
- JWT protects custom lobby endpoints (`/start`, and future `/leave`, `/kick`)
- Both tokens issued at join time

**Option B — Credentials-only:**
- Use boardgame.io `playerCredentials` exclusively
- Custom lobby endpoints accept `{ playerID, playerCredentials }` in the request body
- No `jsonwebtoken` dependency

Choose ONE. Justify your choice in 3–5 bullet points explaining the tradeoff.
Implement the chosen approach consistently across all deliverables.

---

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Middleware is a named function** — declare `function requireValidJwt(request, response, next)`
  and export it. Do not return a middleware from a factory.
- **JWT verification is step-by-step** — separate the token extraction, verification,
  and `matchID` check into sequential `if` blocks, each with a `// why:` comment.
  ```js
  // BAD — all in one expression
  const player = token && jwt.verify(token, secret) || null;

  // GOOD — readable steps
  const authorizationHeader = request.headers['authorization'];
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    // why: no token was provided; the client is not authenticated
    response.status(401).json({ error: 'Authorization header with Bearer token is required.' });
    return;
  }
  const token = authorizationHeader.slice(7);
  ```
- **Readable names** — `decodedToken`, `tokenMatchID`, `requestMatchID`,
  not `decoded`, `mID`, `id`.
- **JWT payload fields are explicitly named** — write out each field in the sign call,
  not spread from an object.
- **Startup guard is explicit** — the `JWT_SECRET` check is a plain `if` block
  at the top of `server.mjs`, not a helper function.

---

## Deliverables (Option A — JWT)

### 1. JWT middleware (`src/auth/middleware.mjs`)
1. Read `Authorization: Bearer <token>` header
2. Verify using `jsonwebtoken` + `JWT_SECRET` from env
3. Attach `{ playerName, matchID, playerID, seat }` to `req.player`
4. Return 401 JSON with a full-sentence error if missing or invalid
5. Return 403 JSON if token `matchID` does not match route `:matchID`

Each check must be its own `if` block with a `// why:` comment.

### 2. Token issuance (update `src/lobby/routes.mjs`)
Update `POST /lobby/games/:matchID/join` to also:
- Sign JWT with explicitly listed fields:
  `{ playerName, matchID, playerID, seat, iat, exp: now+7d }`
- Return `{ token, playerCredentials }`

Write the `jwt.sign()` call with each field listed explicitly — not spread from
an object.

### 3. Protect `/lobby/games/:matchID/start`
- Require JWT via middleware
- Only seat 0 (the host) may start — return 403 with a full-sentence message otherwise

### 4. `.env.example` update
Add:
```ini
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Never commit a real value. Rotate by updating Render env var + redeploying.
JWT_SECRET=your-32-byte-hex-string-here
```

### 5. Server startup guard
In `src/server.mjs`, before starting the server, as a plain `if` block:
```javascript
if (!process.env.JWT_SECRET) {
  console.error('[auth] JWT_SECRET is not set — the server cannot start without it. Set this value in your .env file or Render dashboard.');
  process.exit(1);
}
```

### 6. Limitations section
Add a `## Limitations` block (as a code comment or README section) stating:
- No rate limiting on join attempts
- Tokens cannot be revoked before expiry (7 day TTL)
- Display names are not globally unique
- Not suitable for public play with strangers

---

## Deliverables (Option B — Credentials-only)

### 1. Lobby endpoint protection
Update `POST /lobby/games/:matchID/start` to accept and validate:
- Body: `{ playerID: number, playerCredentials: string }`
- Validate credentials against boardgame.io server APIs for that match/playerID
- Return 403 with a full-sentence message if playerID is not seat 0

### 2. No new dependencies
Do NOT add `jsonwebtoken`. Document why credentials-only is sufficient.

### 3. Limitations section
Same limitations as Option A plus: credentials are long-lived and cannot
be rotated without ending the game session.

---

## Hard Constraints

- ESM only
- No Passport, Auth0, Clerk, or similar auth frameworks
- No database table for tokens
- JWT secret from environment variable only (if using Option A)
- Server must exit with clear, full-sentence error if `JWT_SECRET` is missing at startup
  (Option A only)
- **Middleware is a named function declaration** — not returned from a factory
- **Each validation check is its own `if` block** with a `// why:` comment
- **JWT sign call lists each field explicitly** — no object spread
- **Readable variable names** — no abbreviations
- **No nested ternaries**
- **All error response bodies are full sentences**
- **No function longer than 30 lines**
