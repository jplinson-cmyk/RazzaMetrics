import {
  budget,
  digest,
  Env,
  external,
  HttpError,
  json,
  now,
  stmt,
  uid,
} from "./core";
export interface Identity {
  id: string;
  email: string;
  name: string;
  avatar: string;
}
export function allowedGoogleEmail(email: unknown, verified: unknown): boolean {
  return verified === true && typeof email === 'string' && /^[^@\s]+@razzaconsulting\.com$/i.test(email);
}
interface Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  expiresAt?: number;
}
const scope =
  "openid email profile https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly";
export function cookie(req: Request, key: string) {
  return req.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(key + "="))
    ?.slice(key.length + 1);
}
function cookieHeader(env: Env, key: string, value: string, seconds: number) {
  return `${key}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(env.APP_BASE_URL).protocol === "https:" ? "; Secure" : ""}`;
}
export const MANUAL_ADMIN_ID = "manual-admin";
export function manualLoginConfigured(env: Env) {
  return /^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(
    env.MANUAL_ADMIN_PASSWORD_HASH || "",
  );
}
export async function manualLogin(
  req: Request,
  env: Env,
  username: string,
  password: string,
) {
  if (!manualLoginConfigured(env))
    throw new HttpError(503, "Manual login is not configured on the server.");
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  await budget(
    env,
    "manual-login:" + (await digest(ip)),
    "attempts:" + now().slice(0, 13),
    20,
  );
  const [salt, expected] = env.MANUAL_ADMIN_PASSWORD_HASH!.split(":");
  const bytes = (hex: string) =>
    Uint8Array.from(hex.match(/.{2}/g)!, (b) => parseInt(b, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: bytes(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
  const expectedBytes = bytes(expected);
  let difference = 0;
  for (let i = 0; i < actual.length; i++)
    difference |= actual[i] ^ expectedBytes[i];
  if (difference !== 0 || username !== (env.MANUAL_ADMIN_USERNAME || "admin"))
    throw new HttpError(401, "Invalid username or password.");
  const session = uid() + uid();
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      MANUAL_ADMIN_ID,
      "admin@manual.local",
      "Admin",
      "",
      now(),
    ),
    stmt(
      env,
      "INSERT INTO sessions VALUES(?,?,?)",
      await digest(session),
      MANUAL_ADMIN_ID,
      Date.now() + 7 * 86400000,
    ),
  ]);
  const response = json({ success: true });
  response.headers.set(
    "Set-Cookie",
    cookieHeader(env, "razza_session", session, 7 * 86400),
  );
  return response;
}
export async function identity(req: Request, env: Env): Promise<Identity> {
  const token = cookie(req, "razza_session");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const user = await stmt(
    env,
    `SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires_at>?`,
    await digest(token),
    Date.now(),
  ).first<Identity>();
  if (!user) throw new HttpError(401, "Session expired. Sign in again.");
  return user;
}
export async function crypt(env: Env, text: string, decrypt = false) {
  if (!env.APP_ENCRYPTION_KEY)
    throw new HttpError(503, "APP_ENCRYPTION_KEY is not configured.");
  const bytes = Uint8Array.from(atob(env.APP_ENCRYPTION_KEY), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length !== 32)
    throw new HttpError(503, "APP_ENCRYPTION_KEY must encode 32 bytes.");
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  if (decrypt) {
    const [iv, data] = text
      .split(".")
      .map((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
    return new TextDecoder().decode(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data),
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(text),
    ),
  );
  return [iv, encrypted].map((b) => btoa(String.fromCharCode(...b))).join(".");
}
export async function beginOAuth(req: Request, env: Env) {
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.APP_ENCRYPTION_KEY
  )
    throw new HttpError(
      503,
      "Configure Google OAuth and APP_ENCRYPTION_KEY on the server first.",
    );
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project");
  let user: Identity | undefined;
  if (projectId) {
    user = await identity(req, env);
    if (
      !(await stmt(
        env,
        "SELECT id FROM projects WHERE id=? AND owner_id=?",
        projectId,
        user.id,
      ).first())
    )
      throw new HttpError(404, "Project not found.");
  }
  await budget(env, "global", "oauth", 200);
  const state = uid();
  const verifier = uid() + uid();
  await stmt(
    env,
    "INSERT INTO oauth_states VALUES(?,?,?,?,?)",
    await digest(state),
    verifier,
    user?.id,
    projectId,
    Date.now() + 600000,
  ).run();
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope,
    state,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://accounts.google.com/o/oauth2/v2/auth?" + params,
      "Set-Cookie": cookieHeader(env, "razza_oauth", state, 600),
    },
  });
}
export async function callback(req: Request, env: Env, onConnected?: (userId: string) => void) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  if (!state || cookie(req, "razza_oauth") !== state)
    throw new HttpError(400, "OAuth state validation failed. Restart sign in.");
  const record = await stmt(
    env,
    "DELETE FROM oauth_states WHERE id=? AND expires_at>? RETURNING *",
    await digest(state),
    Date.now(),
  ).first<{ verifier: string; user_id?: string; project_id?: string }>();
  if (!record || !url.searchParams.get("code"))
    throw new HttpError(
      400,
      "OAuth expired or consent was denied. Restart sign in.",
    );
  const token = await (
    await external("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code: url.searchParams.get("code")!,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: record.verifier,
      }),
    })
  ).json<Tokens>();
  if (
    !token.scope
      ?.split(" ")
      .includes("https://www.googleapis.com/auth/webmasters.readonly")
  )
    throw new HttpError(403, "Search Console permission was not granted.");
  const profile = await (
    await external("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
  ).json<{
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
  }>();
  if (!allowedGoogleEmail(profile.email, profile.email_verified))
    throw new HttpError(
      403,
      "Google sign-in is restricted to verified @razzaconsulting.com email addresses.",
    );
  // Linking Google from a manual account must keep projects owned by that account.
  if (record.user_id) {
    const signedIn = await identity(req, env);
    if (signedIn.id !== record.user_id)
      throw new HttpError(
        403,
        "The linking session changed. Restart Google connection.",
      );
    if (record.user_id !== MANUAL_ADMIN_ID && record.user_id !== profile.sub)
      throw new HttpError(
        403,
        "Connect the same Google account used to sign in.",
      );
  }
  const accountId = record.user_id || profile.sub;
  const previous = await stmt(
    env,
    "SELECT encrypted_tokens FROM google_connections WHERE user_id=?",
    accountId,
  ).first<{ encrypted_tokens: string }>();
  if (!token.refresh_token && previous)
    token.refresh_token = JSON.parse(
      await crypt(env, previous.encrypted_tokens, true),
    ).refresh_token;
  if (!token.refresh_token)
    throw new HttpError(
      400,
      "Google did not issue offline access. Revoke prior consent and reconnect.",
    );
  token.expiresAt = Date.now() + token.expires_in * 1000;
  const session = uid() + uid();
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,avatar=excluded.avatar",
      accountId,
      accountId === MANUAL_ADMIN_ID ? "admin@manual.local" : profile.email,
      accountId === MANUAL_ADMIN_ID ? "Admin" : profile.name || profile.email,
      profile.picture || "",
      now(),
    ),
    stmt(
      env,
      "INSERT INTO google_connections VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,scopes=excluded.scopes,updated_at=excluded.updated_at",
      accountId,
      await crypt(env, JSON.stringify(token)),
      token.scope,
      now(),
    ),
    stmt(
      env,
      "INSERT INTO sessions VALUES(?,?,?)",
      await digest(session),
      accountId,
      Date.now() + 7 * 86400000,
    ),
  ]);
  onConnected?.(accountId);
  const headers = new Headers({ Location: env.APP_BASE_URL });
  headers.append(
    "Set-Cookie",
    cookieHeader(env, "razza_session", session, 7 * 86400),
  );
  headers.append("Set-Cookie", cookieHeader(env, "razza_oauth", "", 0));
  return new Response(null, { status: 302, headers });
}
export async function accessToken(env: Env, userId: string) {
  const connection = await stmt(
    env,
    "SELECT encrypted_tokens FROM google_connections WHERE user_id=?",
    userId,
  ).first<{ encrypted_tokens: string }>();
  if (!connection)
    throw new HttpError(409, "Connect your Google account first.");
  const tokens = JSON.parse(
    await crypt(env, connection.encrypted_tokens, true),
  ) as Tokens;
  if ((tokens.expiresAt || 0) > Date.now() + 60000) return tokens.access_token;
  try {
    const refreshed = await (
      await external("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token!,
          grant_type: "refresh_token",
        }),
      })
    ).json<Tokens>();
    const updated = {
      ...tokens,
      ...refreshed,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await stmt(
      env,
      "UPDATE google_connections SET encrypted_tokens=?,updated_at=? WHERE user_id=?",
      await crypt(env, JSON.stringify(updated)),
      now(),
      userId,
    ).run();
    return updated.access_token;
  } catch {
    throw new HttpError(
      409,
      "Google token refresh failed. Reconnect your Google account.",
    );
  }
}
export async function logout(req: Request, env: Env) {
  const token = cookie(req, "razza_session");
  if (token)
    await stmt(
      env,
      "DELETE FROM sessions WHERE id=?",
      await digest(token),
    ).run();
  return new Response("{}", {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader(env, "razza_session", "", 0),
    },
  });
}
export async function disconnect(env: Env, userId: string) {
  const row = await stmt(
    env,
    "SELECT encrypted_tokens FROM google_connections WHERE user_id=?",
    userId,
  ).first<{ encrypted_tokens: string }>();
  if (row) {
    const token = JSON.parse(
      await crypt(env, row.encrypted_tokens, true),
    ) as Tokens;
    // Do not pretend a failed revocation succeeded; credentials remain for retry.
    await external("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: token.refresh_token || token.access_token,
      }),
    });
  }
  await env.DB.batch([
    stmt(env, "DELETE FROM google_connections WHERE user_id=?", userId),
    stmt(
      env,
      "UPDATE projects SET gsc_property=NULL,updated_at=? WHERE owner_id=?",
      now(),
      userId,
    ),
    stmt(
      env,
      "UPDATE background_jobs SET status='CANCELLED' WHERE type='gsc' AND project_id IN (SELECT id FROM projects WHERE owner_id=?) AND status IN ('QUEUED','RUNNING')",
      userId,
    ),
  ]);
  return json({ disconnected: true });
}
