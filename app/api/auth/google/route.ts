import { env } from "cloudflare:workers";
import { createSession, ensureAuthSchema } from "../../../../lib/auth";

type GoogleToken = { aud?: string; email?: string; email_verified?: string; name?: string; picture?: string; sub?: string };

export async function POST(request: Request) {
  await ensureAuthSchema();
  const { credential } = await request.json() as { credential?: string };
  if (!credential) return Response.json({ error: "Google credential is required." }, { status: 400 });
  const clientId = String(env.GOOGLE_CLIENT_ID || "");
  if (!clientId) return Response.json({ error: "Google login is not configured yet." }, { status: 503 });

  const verification = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!verification.ok) return Response.json({ error: "Google could not verify this login." }, { status: 401 });
  const profile = await verification.json() as GoogleToken;
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email || profile.email_verified !== "true" || profile.aud !== clientId) {
    return Response.json({ error: "The Google identity is invalid." }, { status: 401 });
  }

  const user = await env.DB.prepare("SELECT id, email, role, is_active isActive FROM users WHERE lower(email)=lower(?)").bind(email).first<{ id:number; email:string; role:string; isActive:number }>();
  if (!user) return Response.json({ error: "Your email has not been approved by the CRM administrator." }, { status: 403 });
  if (!user.isActive) return Response.json({ error: "Your CRM access has been disabled." }, { status: 403 });

  await env.DB.prepare("UPDATE users SET name=?, picture=?, last_login_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(String(profile.name || email), String(profile.picture || ""), user.id).run();
  const session = await createSession(user.id);
  return Response.json({ user: { email, name: profile.name || email, picture: profile.picture || "", role: user.role } }, { headers: { "Set-Cookie": session.cookie } });
}

