import { env } from "cloudflare:workers";

export const ADMIN_EMAIL = "belsare.suyog@gmail.com";
const SESSION_COOKIE = "optispace_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  picture: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
};

let authSchemaReady = false;

export async function ensureAuthSchema() {
  if (authSchemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      email text NOT NULL UNIQUE,
      name text DEFAULT '' NOT NULL,
      picture text DEFAULT '' NOT NULL,
      role text DEFAULT 'USER' NOT NULL,
      is_active integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      last_login_at text
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token text PRIMARY KEY NOT NULL,
      user_id integer NOT NULL,
      expires_at text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)"),
    env.DB.prepare("INSERT OR IGNORE INTO users (email, name, role, is_active) VALUES (?, 'Suyog Belsare', 'ADMIN', 1)").bind(ADMIN_EMAIL),
    env.DB.prepare("UPDATE users SET role='ADMIN', is_active=1, updated_at=CURRENT_TIMESTAMP WHERE lower(email)=lower(?)").bind(ADMIN_EMAIL),
  ]);
  authSchemaReady = true;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function getRequestUser(request: Request): Promise<AuthUser | null> {
  await ensureAuthSchema();
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.email, u.name, u.picture, u.role, u.is_active isActive
    FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active=1`).bind(token).first<AuthUser & { isActive: number }>();
  if (!row) return null;
  return { ...row, role: row.role === "ADMIN" ? "ADMIN" : "USER", isActive: Boolean(row.isActive) };
}

export async function requireRequestUser(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return { user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  return { user, response: null };
}

export async function requireAdmin(request: Request) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth;
  if (auth.user?.role !== "ADMIN") return { user: auth.user, response: Response.json({ error: "Administrator access required." }, { status: 403 }) };
  return auth;
}

export async function createSession(userId: number) {
  await ensureAuthSchema();
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await env.DB.prepare("INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expires.toISOString()).run();
  return {
    token,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

export async function deleteSession(request: Request) {
  await ensureAuthSchema();
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token=?").bind(token).run();
}

export const clearedSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

