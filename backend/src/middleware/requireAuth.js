/**
 * Supabase JWT auth middleware (v1.0.0 release gate).
 *
 * Verifies a Bearer token via supabase.auth.getUser(token) and attaches the
 * resolved user to req.user. Auth is ON by default; set AUTH_DISABLED=true to
 * bypass it for local dev and the api test server (which hit the API without a
 * token). Fails closed: a verifier/transport error returns 503 rather than
 * letting the request through.
 *
 * createRequireAuth accepts an injectable verifyToken(token) -> user|null so the
 * middleware is unit-testable offline without a network round-trip.
 */
const { createClient } = require('@supabase/supabase-js');

let _client;

function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

function authDisabled() {
  return process.env.AUTH_DISABLED === 'true';
}

// Default verifier: resolve the token against Supabase Auth.
// Returns the user object, null for an invalid/expired token, or throws on a
// transport/config failure (→ caller returns 503, fail closed).
async function defaultVerify(token) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase not configured (set SUPABASE_URL and SUPABASE_ANON_KEY)');
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    // getUser surfaces both "bad token" and transport errors via `error`.
    // Treat an explicit auth rejection (401/403) as an invalid token (→ 401);
    // anything else is a transport/config failure (→ 503, fail closed).
    const status = error.status || error.code;
    if (status === 401 || status === 403) return null;
    throw error;
  }
  return data && data.user ? data.user : null;
}

function createRequireAuth(options = {}) {
  const verifyToken = options.verifyToken || defaultVerify;

  return async function requireAuth(req, res, next) {
    if (authDisabled()) return next();

    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    let user;
    try {
      user = await verifyToken(match[1]);
    } catch (err) {
      console.error('[auth] token verification failed:', err.message);
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  };
}

module.exports = { createRequireAuth, defaultVerify, authDisabled };
