import { env } from "cloudflare:workers";
import { ADMIN_EMAIL, ensureAuthSchema, requireAdmin } from "../../../../lib/auth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const rows = await env.DB.prepare("SELECT id, email, name, picture, role, is_active isActive, created_at createdAt, last_login_at lastLoginAt FROM users ORDER BY role='ADMIN' DESC, email").all();
  return Response.json({ users: rows.results });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { email?: string };
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  await ensureAuthSchema();
  await env.DB.prepare("INSERT INTO users (email, role, is_active) VALUES (?, 'USER', 1) ON CONFLICT(email) DO UPDATE SET is_active=1, updated_at=CURRENT_TIMESTAMP").bind(email).run();
  return Response.json({ added: true, email }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { id?: number; isActive?: boolean; role?: "ADMIN" | "USER" };
  const id = Number(body.id);
  if (!id) return Response.json({ error: "User id is required." }, { status: 400 });
  const row = await env.DB.prepare("SELECT email, role, is_active isActive FROM users WHERE id=?").bind(id).first<{email:string;role:string;isActive:number}>();
  if (!row) return Response.json({ error: "User not found." }, { status: 404 });
  const isPrimary = row.email.toLowerCase() === ADMIN_EMAIL;
  if (isPrimary && (body.isActive === false || body.role === "USER")) return Response.json({ error: "The primary administrator cannot be disabled or demoted." }, { status: 400 });
  const nextRole = body.role === "ADMIN" || body.role === "USER" ? body.role : row.role;
  const nextActive = typeof body.isActive === "boolean" ? body.isActive : Boolean(row.isActive);
  await env.DB.prepare("UPDATE users SET role=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(nextRole, nextActive ? 1 : 0, id).run();
  if (!nextActive || nextRole !== row.role) await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(id).run();
  return Response.json({ updated: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "User id is required." }, { status: 400 });
  const row = await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(id).first<{email:string}>();
  if (!row) return Response.json({ error: "User not found." }, { status: 404 });
  if (row.email.toLowerCase() === ADMIN_EMAIL) return Response.json({ error: "The primary administrator cannot be deleted." }, { status: 400 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(id),
    env.DB.prepare("DELETE FROM users WHERE id=?").bind(id),
  ]);
  return Response.json({ deleted: true, id });
}
